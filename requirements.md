# 🏋️ ARNOLD - Documento de Requisitos del Sistema (SRS)

## 📌 1. Descripción General del Proyecto
**ARNOLD** es un Sistema Integral de Gestión para Gimnasios orientado a automatizar los procesos operativos, administrativos y de seguimiento de socios. La plataforma busca erradicar la dependencia de memoria humana en recepcionistas, reducir tiempos de espera de instructores y socios, y brindar trazabilidad completa en asistencias, pagos y progresiones físicas.

### Stack Tecnológico Pactado
* * **Frontend**: Next.js 15 (App Router, React 19, TypeScript).
* **Backend**: Next.js API Routes (arquitectura monolítica, sin backend separado) + PostgreSQL vía Supabase.
* **Arquitectura Frontend**: Clean Architecture (división estricta en `models/`, `adapters/`, `services/`, `redux/` o estado global, `components/`, `utilities/`).
* **Metodología de Desarrollo**: Proceso Unificado (UP) + Spec-Driven Development (SDD) + TDD.

---

## 👥 2. Actores del Sistema (Roles)
* **`ACT-01` Administrador**: Máximo nivel de privilegios. [cite_start]Administra usuarios internos, máquinas, parámetros generales, cierres de caja, reportes y auditoría[cite: 53, 54].
* [cite_start]**`ACT-02` Instructor**: Crea y gestiona el catálogo de ejercicios y plantillas de rutinas, las asigna a socios y monitorea progresos físicos[cite: 57, 58].
* [cite_start]**`ACT-03` Recepcionista**: Atiende en el mostrador, registra socios nuevos, cobra cuotas/membresías, consulta asistencias y autoriza ingresos manuales[cite: 60, 61].
* **`ACT-04` Socio**: Cliente final del gimnasio. Consulta sus rutinas, su historial de asistencias y su estado de cuenta desde el portal. [cite_start]Utiliza el módulo de asignación dinámica durante el entrenamiento[cite: 63, 64, 65].

---

## 🎯 3. Hoja de Ruta por Fases (Metodología UP)

### 🔹 Fase 1: MVP Core (Administración y Operatoria Base)
1. [cite_start]**Autenticación y Usuarios**: Login unificado (`/login`) con redirección por rol[cite: 81, 725, 2241].
2. [cite_start]**Gestión de Socios y Empleados**: Registros (CRUD), credenciales provisorias y estados (Activo, Inactivo, Pendiente)[cite: 509, 510, 519, 1315, 1344].
3. [cite_start]**Membresías, Cuotas y Pagos**: Registro de cobros manuales (Efectivo / Transferencia), generación de comprobantes y cierres de caja[cite: 348, 854, 855, 1745].
4. [cite_start]**Control de Acceso y Asistencias Base**: Validación del estado de cuota en el momento de ingreso y asistencia manual por recepcionista[cite: 82, 480, 481, 2236].
5. [cite_start]**Catálogo de Ejercicios y Rutinas Base**: Creación de ejercicios, armado de plantillas de rutinas y asignación a socios[cite: 86, 87].

### 🔹 Fase 2: Procesos Automatizados e Inteligentes
1. [cite_start]**Módulo de Asignación Dinámica de Máquinas (`UC-10`)**: Reordenamiento en vivo de la rutina según disponibilidad de máquinas, cálculo de tiempos por serie/descanso y temporizador[cite: 386, 976, 2238, 2239].
2. [cite_start]**Módulo de Planificación Automática de Entrenamiento**: Progresión periódica automática (Fuerza, Hipertrofia, Descarga) con o sin registro de cargas[cite: 119, 2276, 2284].
3. [cite_start]**Módulo de Recomendación de Horarios**: Análisis histórico de concurrencia y aforo en vivo[cite: 122, 2291, 2295].
4. [cite_start]**Módulo de Recuperación de Socios Inactivos**: Secuencia escalonada automatizada de notificaciones por inactividad[cite: 39, 2301].

---

## 📋 4. Reglas de Negocio Clave (`RN`)

* [cite_start]**`RN-01` Membresía activa única**: Un socio solo puede tener una membresía activa a la vez[cite: 1896].
* * **`RN-02` Restricción de acceso por vencimiento**: El período de gracia es un parámetro configurable por el Administrador (`periodoGracia` en `ConfiguracionDelSistema`), con valor por defecto de **0 días**. Al vencer la cuota, sumado el período de gracia configurado, el acceso se deniega automáticamente.
* [cite_start]**`RN-03` Excepción de Ingreso Manual**: Si el socio tiene cuota vencida o falla el sistema de validación automática, el Recepcionista/Administrador puede forzar el ingreso con un flag de *"Autorizado Excepcionalmente"* que queda registrado en auditoría y diferido en el historial de asistencias.
* [cite_start]**`RN-04` Rutina activa única**: Un socio solo puede poseer una rutina activa asignada a la vez[cite: 1115, 1922].
* [cite_start]**`RN-05` Restricción de equipamiento fuera de servicio**: Máquinas marcadas como `Fuera de Servicio` o `Inactiva` no se consideran disponibles para el módulo de asignación dinámica[cite: 1871, 1912].
* [cite_start]**`RN-06` Control de acceso según Rol**: Un usuario solo puede acceder a las pantallas y Server Actions habilitados para su rol[cite: 1917].
* [cite_start]**`RN-07` Límite de Tiempo en Máquinas**: En la sesión de entrenamiento (`UC-10`), el cálculo de ocupación se basa en temporizadores con límites mínimos y máximos por serie y descanso marcados por el socio.

---

## 🗄️ 5. Entidades del Dominio (`Models`)

### Usuarios y Roles

**Usuario** (base): nombre, email, contraseña (cifrada), rol (Socio/Recepcionista/Instructor/Administrador), estado (Activo/Inactivo/Bloqueado)

**Socio** (extiende Usuario): dni, telefono, fechaAlta, estadoCuota (Al día/Vencida/Pendiente)

**Empleado** (extiende Usuario): cargo (Recepcionista/Instructor/Administrador), turno (Mañana/Tarde/Noche), estadoLaboral

### Membresías, Cuotas y Pagos

**Membresía**: nombre, precio (decimal), periodicidad (integer, días), estado (Activa/Inactiva)

**Cuota**: fechaInicio, fechaVencimiento, estado (Vigente/Vencida), socio (referencia)

**Pago**: fechaPago, monto (decimal), metodoPago (Efectivo/Transferencia/Tarjeta), estado (Confirmado/Pendiente/Anulado)

### Entrenamiento

**Ejercicio**: nombre, grupoMuscular, descripcion

**Rutina**: nombre, objetivoPrincipal, frecuenciaSemanal (integer, días 1-7), duracionEstimada (integer, minutos), nivelDeDificultad (Básico/Intermedio/Avanzado), descripcion

**EjercicioEnRutina** (relación Rutina↔Ejercicio): series (integer), repeticiones (integer), descanso (integer, segundos)

**SesionDeEntrenamiento**: horaInicio, horaFin, rutina (referencia), estadoDeFinalizacion (Completada/Incompleta/Abandonada), observaciones

**RegistroDeProgreso**: carga (decimal, kg), repeticiones (integer), pesoCorporal (decimal, kg), fecha, ejercicio (referencia)

**ReglaDeProgresion**: tipo (Lineal/Ondulante), incrementoSugerido (decimal, kg)

### Operación y Equipamiento

**Máquina**: nombre, tipoEquipamiento (Máquina guiada/Peso libre/Cardio), estado (Disponible/Ocupada/Fuera de Servicio/Inactiva), ubicacion, fechaAlta

**Asistencia**: fechaHora (momento de ingreso), socio (referencia), estadoAlIngresar (estado de cuota/autorización en ese momento, ver RN-03)

### Comunicación y Sistema

**Notificación**: tipo (Vencimiento/Asignación de rutina/Inactividad/Recomendación), canal (Email/WhatsApp), estado (Enviada/Pendiente), fechaLectura (nulo si no fue leída)

**CierreDeCaja**: totalRecaudado, totalEfectivo, totalTransferencia, totalTarjeta (decimales), cantidadOperaciones (integer), observaciones, responsable (referencia a Empleado)

**RegistroDeAuditoria**: tipoOperacion (Alta/Baja/Modificación/Anulación), fechaHora, responsable (referencia a Usuario)

**ConfiguracionDelSistema**: capacidadMaxima (integer), periodoGracia (integer, días, ver RN-02), diasInactividad (integer), descuentoReactivacion (decimal, %), ventanaAforoMinutos (integer, default 90)

**OcupacionPorFranja**: franjaHoraria, diaDeSemana, nivelDeOcupacionHistorico (decimal/porcentaje)