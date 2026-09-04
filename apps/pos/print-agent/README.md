# Seoul Shop Print Agent

Agente local de impresión ESC/POS para el POS. Escucha en `http://127.0.0.1:9101`.

## Instalación

### Mac / Linux
```bash
cd apps/pos/print-agent
npm install
npm start
```

### Windows
```bash
cd apps\pos\print-agent
npm install
npm start
```

Para que arranque automáticamente al iniciar sesión:
- **Mac**: `launchctl` o agregarlo a Login Items.
- **Windows**: Agregar un acceso directo en `shell:startup` o usar NSSM como servicio.

## Impresoras soportadas

- Epson TM-T20, TM-T82, TM-T88V/VI, TM-m30
- Bixolon SRP-350/352/380 (ESC/POS compatible)
- Star Micronics TSP100/143 (modo ESC/POS)
- Cualquier impresora ESC/POS genérica USB

## Configuración (`src/config.json`)

```json
{
  "port": 9101,
  "printerType": "EPSON",
  "interface": "usb",
  "width": 42
}
```

`interface` puede ser:
- `"usb"` — conexión directa USB (recomendado)
- `"tcp://192.168.1.100:9100"` — red Ethernet/WiFi
- `"/dev/usb/lp0"` — puerto Linux
- `"//./COM3"` — puerto COM Windows

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /health | Estado del agente e impresora |
| POST | /print | Imprimir un ticket (TicketPayload JSON) |
| POST | /open-drawer | Abrir cajón monedero |
| GET | /config | Ver configuración actual |
| POST | /config | Actualizar configuración |
