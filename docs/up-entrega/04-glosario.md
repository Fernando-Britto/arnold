# 4) Glosario de Arnold

> **Fuente de verdad**: `arnold/openspec/specs/*/spec.md`, `arnold/openspec/decisions.md`,
> `arnold/prisma/schema.prisma` y el código de `arnold/src/`.
> **Fecha de extracción**: 2026-11-16.
> **Regla**: cada término se define **como lo usa este sistema**, no en su sentido genérico. Si el
> sistema no usa un término, figura marcado. La fuente va al final de cada comentario, entre
> paréntesis.

| Término | Categoría | Comentario |
|---|---|---|
| **Socio** | Negocio | La persona que se entrena. Ficha en `Socio` (dni único, teléfono, fechaAlta, estadoCuota, pinHash, huellaId) y su identidad de login en `Usuario`. Es el "cliente" del gimnasio. (`prisma/schema.prisma`) |
| **Cliente** | Negocio | Sinónimo de socio. No es una entidad distinta: `/clientes` y el dominio `Cliente` son la vista CRUD de `Socio`. (`src/domains/cliente/cliente.ts`) |
| **Empleado** | Negocio | El staff con ficha laboral: turno y estado laboral. Todo `Empleado` cuelga de un `Usuario` con rol `ADMINISTRADOR`, `INSTRUCTOR` o `RECEPCIONISTA`. (`prisma/schema.prisma` → `Empleado`) |
| **Rol** | Negocio | `ADMINISTRADOR`, `INSTRUCTOR`, `RECEPCIONISTA` o `SOCIO`. **No son entidades**: son valores del enum `Rol` dentro de `Usuario`. (`prisma/schema.prisma`) |
| **Membresía** | Negocio | Plan vendible: nombre, precio, periodicidad en días y estado `ACTIVA`/`INACTIVA`. Se asigna a un socio, uno a la vez. (`prisma/schema.prisma` → `Membresia`) |
| **Cuota** | Pagos | Tramo de cobertura `fechaInicio → fechaVencimiento` (un mes). **No es el monto**: el dinero está en `Pago.monto`. Es la fuente de verdad de "hasta cuándo está cubierto". (`prisma/schema.prisma` → `Cuota`) |
| **Cuota vigente** | Pagos | La última `Cuota` del socio cuya `fechaVencimiento` todavía no pasó (en hora del gimnasio). No es un estado persistido: se deduce. (`src/domains/pago/cuota.ts`) |
| **Cuota vencida** | Pagos | Estado de **pago** calculado cuando pasó el día límite (`diaLimitePago`, 10) más el período de gracia. No confundir con `Cuota.estado = VENCIDA`, que es el estado de la fila. (`estadoCuotaSocio`, `src/domains/pago/cuota.ts`) |
| **Período** | Pagos | Mes calendario (`YYYY-MM`) que cubre una cuota. No se guarda: se deduce de `fechaVencimiento`. (`periodoDe`, `src/domains/pago/cuota.ts`) |
| **Estado de cuenta** | Pagos | `EstadoCuota`: `AL_DIA` (cuenta habilitada, **no** significa que pagó), `INACTIVA` (baja/pausa) o `BLOQUEADA` (sanción, deniega siempre). Decisión humana, **sí** se persiste en `Socio.estadoCuota`. (D-46/P-24) |
| **Estado de pago** | Pagos | `AL_DIA`, `PENDIENTE`, `VENCIDA` o `SIN_CUOTA`. Se **calcula** con `estadoCuotaSocio` a partir de `Cuota` y `Pago`; **nunca se persiste**. (D-40/D-46) |
| **Prorrateo** | Pagos | Cobro de alta que paga sólo los días restantes del mes, contando el día del alta. Aplica hasta `diaCorteAltaTardia` (20) inclusive. (`calcularAlta`, `src/domains/pago/cuota.ts`) |
| **Alta tardía** | Pagos | Alta cerca de fin de mes, hasta el día de corte (20) inclusive: paga prorrateo. (`configuracion.diaCorteAltaTardia`) |
| **Alta completa** | Pagos | Alta **después** del día de corte: paga una cuota completa que cubre lo que queda del mes **y** el mes siguiente. (`planDePago`, `src/domains/pago/cuota.ts`) |
| **Renovación** | Pagos | Pago del período siguiente al último cubierto, completo y sin recargo ni descuento. (`planDePago`) |
| **Deuda retroactiva** | Pagos | Política: un socio que reingresa tras un mes entero sin cobertura se trata como **alta** y **no** se le cobran los meses que faltó. (`src/domains/pago/cuota.ts`) |
| **Pago confirmado** | Pagos | `Pago.estado = CONFIRMADO`. Es el único que suma a la caja y el que se asocia a un cierre. (`prisma/schema.prisma`; `src/domains/cierre/cierre-de-caja.ts`) |
| **Anulación de pago** | Pagos | Pasar un `Pago` a `ANULADO` (queda como evidencia) y borrar la `Cuota` que creó, salvo que otro pago vigente la cubra. Exige motivo y deja auditoría `ANULACION`. (`src/domains/pago/anular-pago.ts`, P-39) |
| **Monto de lista** | Pagos | `Pago.montoLista`: el precio antes del descuento de la oferta. `null` si el pago no tuvo oferta. (D-54) |
| **Oferta de reactivación** | Pagos | Descuento (1–50 %) sobre el cobro de la cuota a un socio con cuota vencida que dejó de asistir. Se calcula al consultar y se aplica dentro de la transacción del cobro. **Apagada por defecto.** (`src/domains/pago/oferta-reactivacion.ts`, D-54) |
| **Enfriamiento** | Pagos | `enfriamientoOfertaDias` (180 por defecto): bloquea una oferta nueva si el último pago con descuento es posterior a `hoy − enfriamiento`. (`evaluarOferta`) |
| **Check-in** | Acceso | Registrar el ingreso del socio. Por DNI + PIN en recepción o por huella en la puerta. Deja `Asistencia` y `AuditoriaAcceso`. (`src/api/acceso.ts`) |
| **PIN** | Acceso | Código de 4 dígitos del check-in, guardado como hash bcrypt (`Socio.pinHash`); nunca en claro. (D-47) |
| **Anti-passback** | Acceso | Ventana de tiempo (`antiPassbackMinutos`, 60 por defecto) dentro de la cual un segundo ingreso `PERMITIDO` del mismo socio se deniega. (`evaluarYRegistrarAcceso`) |
| **Huella** | Acceso | Identificación biométrica por un `huellaId` (1..1000) que vive **en el sensor**, no en Arnold. El sistema sólo guarda la relación socio↔huellaId y la fecha de consentimiento. (D-56) |
| **Override** | Acceso | Autorización excepcional del Administrador para dejar entrar a un socio denegado. Exige motivo (10–500 caracteres) y deja auditoría `OVERRIDE_GRANT`. (`src/api/socios/access-override.ts`) |
| **Kiosco** | Acceso | La pantalla de `/acceso` que queda abierta en recepción. Se opera con toque o con teclado físico. (`KioscoAcceso`) |
| **Dispositivo** | Acceso | Lector de puerta autorizado por token propio (`x-dispositivo-token`), guardado como hash más un prefijo de búsqueda. (`prisma/schema.prisma` → `Dispositivo`) |
| **Rutina** | Entrenamiento | Plantilla con nombre, objetivo, frecuencia, duración y nivel, más su lista ordenada de `EjercicioEnRutina`. (`prisma/schema.prisma` → `Rutina`) |
| **Rutina asignada** | Entrenamiento | Fila `RutinaAsignada`: la rutina concreta de un socio, con `activa`. RN-04: a lo sumo una activa por socio. (`src/domains/rutina/asignar-rutina.ts`) |
| **Ejercicio** | Entrenamiento | Ítem del catálogo: nombre, grupo muscular, descripción y, si viene del dataset, equipamiento, músculos e instrucciones. (`prisma/schema.prisma` → `Ejercicio`) |
| **Ejercicio en rutina** | Entrenamiento | Fila de la rutina con la prescripción: `series`, `repeticiones`, `descanso` (segundos) y `orden`. `updatedAt` significa "último cambio de series o repeticiones". (D-61) |
| **Serie** | Entrenamiento | Una ejecución de un ejercicio. `EjercicioEnRutina.series` es lo **prescrito**; `RegistroDeProgreso.numeroSerie` es la serie **registrada** (1-based). (D-48) |
| **Repetición** | Entrenamiento | Un movimiento dentro de una serie. Prescrito en `EjercicioEnRutina.repeticiones`; registrado en `RegistroDeProgreso.repeticiones`. |
| **RIR** | Entrenamiento | "Reps in reserve" (0–5): cuántas repeticiones quedaban en reserva al terminar la serie. Se valida como entero; un `rir` no numérico es 400. (`src/domains/sesion/sesion-de-entrenamiento.ts`, SE-5) |
| **1RM** | Entrenamiento | Fuerza máxima estimada con la fórmula de **Epley** a partir de carga y repeticiones (hasta 12 reps, redondeada a 0,5 kg). Se usa para las marcas personales. (D-63) |
| **Drop set** | Entrenamiento | Serie con la carga reducida a propósito que **no es una serie nueva de la rutina**: se agrega a la serie ya registrada (`drops`, hasta 5), no mueve la sesión y la progresión la ignora. (D-69) |
| **Calentamiento** | Entrenamiento | Serie de aproximación: se guarda con `numeroSerie = null`, **no** avanza la sesión y no cuenta para volumen, marcas ni progresión. (D-64) |
| **Al fallo** | Entrenamiento | `tipo = HASTA_EL_FALLO`: serie de trabajo llevada al límite. Cuenta como cualquier otra. (D-64) |
| **Sesión de entrenamiento** | Entrenamiento | Ejecución de una `RutinaAsignada` por un socio. Estados `EN_CURSO`, `COMPLETADA`, `INCOMPLETA`, `ABANDONADA`; guarda el punto de retome (`ejercicioActualId` + `serieActual`). (D-44) |
| **Registro de progreso** | Entrenamiento | Una fila por serie registrada: carga, repeticiones, RIR, número de serie, tipo, fecha y sesión. Es la fuente del historial, las marcas y la progresión. (D-48) |
| **Mejor marca** | Entrenamiento | Máximo histórico de `carga` por ejercicio, más la marca de 1RM estimado. (`src/domains/sesion/marcas-ejercicio.ts`) |
| **Progresión** | Entrenamiento | Sugerencia de carga para la próxima sesión: sube si cumplió todas las repeticiones, mantiene si falló, descarga 10 % tras tres sesiones seguidas con fallos. (`src/domains/sesion/progresion-ejercicio.ts`, D-59) |
| **Máquina** | Asignación | Fila de `Maquina`: un **puesto físico** (nombre, tipo de equipamiento, ubicación, estado). El motor la trata como unidad de ocupación. (D-73) |
| **Tipo de equipamiento** | Asignación | `MAQUINA_GUIADA`, `PESO_LIBRE` o `CARDIO`. Clasificación de la máquina, **no** la unidad que se ocupa. (`enum TipoEquipamiento`) |
| **Máquina usable** | Asignación | La que el motor considera para estimar la espera: `DISPONIBLE` u `OCUPADA`. `FUERA_DE_SERVICIO` e `INACTIVA` quedan afuera. (D-75) |
| **Candidata** | Asignación | Máquina que puede hacer un ejercicio, es decir, existe una fila de `EjercicioMaquina` para ese par. (D-74) |
| **Motor de espera** | Asignación | Dominio **puro** que calcula, para cada ejercicio pendiente, cuánto se esperaría en cada máquina candidata y elige el de menor espera. Sin base de datos ni HTTP. (`src/domains/asignacion/motor-espera.ts`) |
| **Reserva** | Asignación | Fila `AsignacionDeEjercicio` en estado `RESERVADA`: el resultado del cálculo, con `esperaSegundos`, `ahorroSegundos` y `venceEn`. La crea el cálculo, **no** el `GET` ni el `ACEPTAR`. (D-93/D-94) |
| **Reserva vencida** | Asignación | Reserva con `venceEn` ya pasado. No se puede aceptar: el error es `SIN_SUGERENCIA_VIGENTE` (409). (D-89/D-102) |
| **Ocupante** | Asignación | Quien está usando una máquina ahora: una sesión con una asignación `EN_CURSO`. Se cuenta con corte de inactividad (`minutosInactividadSesion`, 30). (D-97/D-105) |
| **Cola** | Asignación | Los socios que esperan la misma máquina (reservas activas de terceros). Cada miembro aporta su propio `descanso`. (D-82) |
| **Espera** | Asignación | Segundos estimados hasta poder usar la máquina si el ejercicio se hace ahora. Se guarda como instantánea. (`motor-espera.ts`) |
| **Ahorro** | Asignación | Segundos que se ganan respecto de seguir el orden de la rutina (el siguiente ejercicio es el baseline). Instantánea inmutable. (D-94) |
| **Decisión de la sugerencia** | Asignación | `ACEPTAR` (confirma la reserva vigente; **no escribe**) o `ESPERAR` (la cancela). No hay tercera opción ni decisión implícita. (D-92, `orquestacion.ts`) |
| **Reasignación** | Asignación | Cambiar la **máquina** de una ejecución `EN_CURSO`: cancela la fila anterior, crea la nueva del mismo ejercicio y audita, en una transacción con advisory lock. No salta el ejercicio ni cambia la sesión. (D-125…D-133) |
| **Aforo** | Operación | Ocupación actual: asistencias `PERMITIDO` dentro de `ventanaAforoMinutos` (90 por defecto) sobre `capacidadMaxima`. Con `capacidadMaxima = 0` muestra "Aforo no configurado". (`computeAforo`) |
| **Ocupación por franja** | Operación | Barras de 2 horas de la ocupación del día. Se **calcula en memoria** desde `Asistencia`; **no existe como tabla**. En el Análisis figura como módulo pendiente de la **Iteración 2**. (`buildAforoHoras`) |
| **Cierre de caja** | Operación | `CierreDeCaja`: totaliza los pagos `CONFIRMADO` sin cierre con `fechaPago ≤ hasta` y les asigna `cierreDeCajaId`. Una vez creado no se edita ni se borra. (`src/domains/cierre/cierre-de-caja.ts`) |
| **Turno** | Operación | Franja laboral del empleado (`MANANA`/`TARDE`/`NOCHE`). El cierre no guarda el rango del turno: se infiere del `createdAt`. (`enum Turno`; D-05) |
| **Inactividad** | Operación | `diasInactividad` (15): umbral de la tarjeta "Socios inactivos" de Home_Interno. Es **distinto** de `diasSinAsistirParaOferta` (30). (`computeInactivos`) |
| **Parámetros del sistema** | Configuración | Los 14 campos configurables de `ConfiguracionDelSistema`: aforo, gracia, inactividad, día límite, corte de alta, anti-passback, oferta y los tres del motor de asignación. |
| **Lector único** | Configuración | `getConfiguracion`: el **único** lugar que lee `ConfiguracionDelSistema`, con defaults por campo. Un test guardián falla si otro archivo de `src` toca la tabla. (`configuracion.guard.test.ts`) |
| **Registro de auditoría** | Auditoría | `RegistroDeAuditoria`: operaciones de negocio (`ALTA`, `BAJA`, `MODIFICACION`, `ANULACION`) con responsable y detalles JSON. Best-effort. (`src/lib/audit.ts`) |
| **Auditoría de acceso** | Auditoría | `AuditoriaAcceso`: login, check-in y accesos denegados, con resultado `ALLOW`/`DENY`, motivo, IP y user-agent. (`prisma/schema.prisma`) |
| **Rate limit** | Técnico | Límite de intentos por IP: **8/min** en login y **20/min** de intentos de identidad fallidos en check-in. (`src/lib/rateLimit.ts`) |
| **Refresh token** | Técnico | Token opaco de 30 días, guardado como hash, con rotación y detección de reuso: usar uno revocado corta toda la cadena del usuario. (D-57, `src/lib/refresh-token.ts`) |
| **Mora** | — | **El sistema no usa este término.** Lo que el negocio llamaría "mora" se modela como el estado de pago calculado `VENCIDA` más `periodoGracia`. (`src/domains/pago/cuota.ts`) |
| **Notificación** | — | **Iteración 2, pendiente.** No hay modelo, tabla ni endpoint de notificaciones, y tampoco queda un elemento de interfaz: la campana inerte de la barra horizontal se retiró con el rail. |
