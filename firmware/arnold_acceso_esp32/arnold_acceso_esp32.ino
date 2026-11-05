/*
 * Arnold - Control de acceso por huella (ESP32 + sensor óptico UART + relé + electroimán)
 *
 * Librerías (Gestor de librerías de Arduino IDE):
 *   - Adafruit Fingerprint Sensor Library
 *   - ArduinoJson (v7)
 *
 * API que debe exponer Arnold (todas con header "Authorization: Bearer <DEVICE_TOKEN>"):
 *
 *  DEVICE_TOKEN es el token de un Dispositivo de tipo PUERTA provisionado desde la pantalla
 *  /dispositivos (se muestra una sola vez al crearlo). Todas las rutas van bajo /api/dispositivo/...,
 *  que es el prefijo que Arnold exime de sesión de usuario para los dispositivos.
 *
 *  1) GET  /api/dispositivo/huellas/pendiente
 *       -> { "accion": "enrolar" | "borrar" | null, "huellaId": 12 }
 *
 *  2) POST /api/dispositivo/huellas/confirmar
 *       body: { "huellaId": 12, "accion": "enrolar", "ok": true, "motivo": "ok" | "timeout" |
 *               "no_coinciden" | "duplicado" | "error_guardado" | "error_borrado",
 *               "duplicadoDe": 7 (solo si motivo = duplicado) }
 *       -> 200
 *
 *  3) POST /api/dispositivo/acceso/verificar
 *       body: { "huellaId": 12, "confianza": 180 }
 *       -> { "autorizado": true | false }
 *       (Arnold busca al socio por huellaId, valida la cuota y registra el intento)
 *
 * Cableado del electroimán fail-safe: el relé corta la corriente para liberar la puerta
 * (ver documento técnico). En reposo el pin del relé está inactivo y la puerta queda trabada.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>

// ======================= CONFIGURACIÓN =======================
const char* WIFI_SSID    = "TU_WIFI";
const char* WIFI_PASS    = "TU_CLAVE";
const char* API_BASE     = "https://tu-dominio.com";   // sin barra final. Para pruebas locales: "http://192.168.1.50:3000"
const char* DEVICE_TOKEN = "CAMBIAR_ESTE_TOKEN";

#define PIN_SENSOR_RX 16   // RX del ESP32 <- TX del sensor
#define PIN_SENSOR_TX 17   // TX del ESP32 -> RX del sensor
#define PIN_RELE      26

const bool     RELE_ACTIVO_ALTO    = true;   // poner false si tu módulo activa con LOW
const uint32_t PULSO_APERTURA_MS   = 4000;   // tiempo con la puerta liberada
const uint16_t CONFIANZA_MINIMA    = 50;     // por debajo se ignora la lectura
const uint32_t POLL_PENDIENTES_MS  = 3000;   // cada cuánto consulta enrolamientos pendientes
const uint32_t TIMEOUT_DEDO_MS     = 15000;  // tiempo máximo esperando el dedo al enrolar
const uint32_t SENSOR_BAUD         = 57600;  // si no responde, probar 9600 o 115200
// =============================================================

HardwareSerial sensorSerial(2);
Adafruit_Fingerprint finger(&sensorSerial);

uint32_t ultimoPoll = 0;

// ---------------------------- Relé ----------------------------
void releSet(bool activo) {
  digitalWrite(PIN_RELE, (activo == RELE_ACTIVO_ALTO) ? HIGH : LOW);
}

void abrirPuerta() {
  Serial.println("Puerta liberada");
  releSet(true);                 // corta corriente al electroimán
  delay(PULSO_APERTURA_MS);
  releSet(false);                // vuelve a energizar: se traba
  Serial.println("Puerta trabada");
}

// ---------------------------- WiFi ----------------------------
void asegurarWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Conectando WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " OK" : " sin conexión");
}

// ---------------------------- API ----------------------------
// Devuelve el código HTTP (o -1 si no hay WiFi / error de conexión).
int llamarApi(const char* metodo, const String& ruta, const String& cuerpo, JsonDocument& respuesta) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  String url = String(API_BASE) + ruta;
  HTTPClient http;
  WiFiClientSecure seguro;
  WiFiClient plano;

  if (url.startsWith("https")) {
    seguro.setInsecure();   // para producción: usar setCACert() con el certificado de tu dominio
    http.begin(seguro, url);
  } else {
    http.begin(plano, url);
  }

  http.setTimeout(5000);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");

  int codigo = http.sendRequest(metodo, cuerpo);
  if (codigo > 0) {
    deserializeJson(respuesta, http.getString());
  }
  http.end();
  return codigo;
}

void confirmarAccion(const char* accion, uint16_t id, bool ok, const char* motivo, int duplicadoDe = -1) {
  JsonDocument cuerpo, resp;
  cuerpo["huellaId"] = id;
  cuerpo["accion"] = accion;
  cuerpo["ok"] = ok;
  cuerpo["motivo"] = motivo;
  if (duplicadoDe >= 0) cuerpo["duplicadoDe"] = duplicadoDe;
  String s;
  serializeJson(cuerpo, s);
  llamarApi("POST", "/api/dispositivo/huellas/confirmar", s, resp);
}

// ------------------------- Enrolamiento -------------------------
bool esperarDedo(uint32_t timeoutMs) {
  uint32_t t0 = millis();
  while (millis() - t0 < timeoutMs) {
    if (finger.getImage() == FINGERPRINT_OK) return true;
    delay(50);
  }
  return false;
}

void esperarSinDedo() {
  uint32_t t0 = millis();
  while (millis() - t0 < 5000) {
    if (finger.getImage() == FINGERPRINT_NOFINGER) return;
    delay(50);
  }
}

// Devuelve el motivo: "ok", "timeout", "no_coinciden", "duplicado", "error_guardado"
const char* enrolar(uint16_t id, int& duplicadoDe) {
  duplicadoDe = -1;

  Serial.println("Enrolar: apoyá el dedo");
  if (!esperarDedo(TIMEOUT_DEDO_MS)) return "timeout";
  if (finger.image2Tz(1) != FINGERPRINT_OK) return "no_coinciden";

  // Evita duplicados: si esta huella ya está en el sensor, no se vuelve a guardar
  if (finger.fingerSearch() == FINGERPRINT_OK) {
    duplicadoDe = finger.fingerID;
    return "duplicado";
  }

  Serial.println("Enrolar: retirá el dedo");
  delay(1000);
  esperarSinDedo();

  Serial.println("Enrolar: apoyá el mismo dedo otra vez");
  if (!esperarDedo(TIMEOUT_DEDO_MS)) return "timeout";
  if (finger.image2Tz(2) != FINGERPRINT_OK) return "no_coinciden";

  if (finger.createModel() != FINGERPRINT_OK) return "no_coinciden";   // las dos capturas no coinciden
  if (finger.storeModel(id) != FINGERPRINT_OK) return "error_guardado"; // guarda en la flash del sensor

  return "ok";
}

void revisarPendientes() {
  JsonDocument resp;
  int codigo = llamarApi("GET", "/api/dispositivo/huellas/pendiente", "", resp);
  if (codigo != 200) return;

  const char* accion = resp["accion"] | "";
  if (strlen(accion) == 0) return;
  uint16_t id = resp["huellaId"] | 0;
  if (id == 0) return;

  if (strcmp(accion, "enrolar") == 0) {
    int duplicadoDe;
    const char* motivo = enrolar(id, duplicadoDe);
    Serial.printf("Enrolamiento id=%u: %s\n", id, motivo);
    confirmarAccion("enrolar", id, strcmp(motivo, "ok") == 0, motivo, duplicadoDe);
  } else if (strcmp(accion, "borrar") == 0) {
    bool ok = (finger.deleteModel(id) == FINGERPRINT_OK);
    Serial.printf("Baja id=%u: %s\n", id, ok ? "ok" : "error");
    confirmarAccion("borrar", id, ok, ok ? "ok" : "error_borrado");
  }
}

// ---------------------------- Acceso ----------------------------
void manejarDedo() {
  if (finger.image2Tz() != FINGERPRINT_OK) return;

  if (finger.fingerSearch() != FINGERPRINT_OK) {
    Serial.println("Huella no reconocida");
    delay(1000);
    return;
  }

  uint16_t id = finger.fingerID;
  uint16_t confianza = finger.confidence;
  Serial.printf("Huella id=%u confianza=%u\n", id, confianza);
  if (confianza < CONFIANZA_MINIMA) return;

  JsonDocument cuerpo, resp;
  cuerpo["huellaId"] = id;
  cuerpo["confianza"] = confianza;
  String s;
  serializeJson(cuerpo, s);

  int codigo = llamarApi("POST", "/api/dispositivo/acceso/verificar", s, resp);
  if (codigo == 200 && (resp["autorizado"] | false)) {
    abrirPuerta();
  } else {
    // Sin conexión o API caída: se deniega (la salida se hace con el pulsador)
    Serial.printf("Acceso denegado (http %d)\n", codigo);
    delay(1500);
  }

  esperarSinDedo();
}

// ---------------------------- Arduino ----------------------------
void setup() {
  releSet(false);                 // puerta trabada desde el arranque
  pinMode(PIN_RELE, OUTPUT);
  releSet(false);

  Serial.begin(115200);
  sensorSerial.begin(SENSOR_BAUD, SERIAL_8N1, PIN_SENSOR_RX, PIN_SENSOR_TX);
  finger.begin(SENSOR_BAUD);

  if (!finger.verifyPassword()) {
    Serial.println("Sensor no encontrado: revisá cableado (TX/RX), alimentación y baudrate");
    while (true) delay(1000);
  }
  finger.getParameters();
  finger.getTemplateCount();
  Serial.printf("Sensor listo. Capacidad: %u, huellas guardadas: %u\n",
                finger.capacity, finger.templateCount);

  asegurarWifi();
}

void loop() {
  asegurarWifi();

  if (finger.getImage() == FINGERPRINT_OK) {
    manejarDedo();
    return;
  }

  if (millis() - ultimoPoll > POLL_PENDIENTES_MS) {
    ultimoPoll = millis();
    revisarPendientes();
  }

  delay(50);
}
