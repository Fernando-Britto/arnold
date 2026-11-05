# Firmware del lector de acceso (ESP32)

Sketch `arnold_acceso_esp32/arnold_acceso_esp32.ino`: lee la huella, la enrola y avisa a la API de
Arnold (`/api/dispositivo/...`) para registrar el acceso.

Antes de flashear, completá en el sketch `WIFI_SSID`, `WIFI_PASS`, `API_BASE` (sin barra final) y
`DEVICE_TOKEN`, que es el token de un Dispositivo de tipo **PUERTA** creado desde la pantalla de
dispositivos. Nunca se versionan credenciales reales: el archivo va con los valores de ejemplo.
