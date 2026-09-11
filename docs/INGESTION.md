# Hosted device-ingestion contract

POST `https://vgenmqsxdqtepiugcznf.supabase.co/functions/v1/device-ingest`

Headers:

- `Content-Type: application/json`
- `Authorization: Bearer <64-character device credential>`
- `X-Device-Id: <registered device UUID>`

Never put the Supabase service-role key or an administrator password on a device. Provision or rotate a device credential through the authenticated Operator Workspace.

Example shape (replace placeholders and use the device's actual measurement time):

```json
{
  "observations": [{
    "id": "unique-persistent-message-id",
    "measuredAt": "<ISO 8601 measurement timestamp with timezone>",
    "averagingSeconds": 60,
    "raw": {
      "pm25": 12.3,
      "pm10": 21.4,
      "temperature": 24.5,
      "humidity": 50,
      "pressure": 1009.2,
      "uv": 2.1
    },
    "quality": "valid",
    "flags": [],
    "calibrationVersion": "<registered calibration version>"
  }]
}
```

The example values are documentation only; none are inserted automatically. Units are µg/m³ for particulate concentrations, °C, percent relative humidity, hPa and UV index. Use null for missing measurements; include all six keys and at least one numerical value. Upload original readings only. Corrected values are rejected until a reviewed correction workflow is implemented.

For mobile devices, include valid `lat` and `lng` in every record. Fixed devices use their registered exact coordinates. Public projection uses the area's generalized centre instead.

## Limits and responses

- Maximum 64 KiB body, 1–100 observations per batch.
- Maximum 60 authenticated batch requests per device per minute; excess returns 429.
- IDs are 1–120 characters. Preserve IDs when retrying.
- Measurement time must contain a timezone, must not be in the future and must be within 31 days. Received time is assigned by the server.
- Averaging seconds must be an integer from 1 to 86400. History/comparison currently uses 3600-second records only.
- Calibration version must match the registration. Quality must be `valid` with no flags, or `suspect` with flags.
- Engineering ranges: PM2.5 0–2000, PM10 0–3000, temperature −50–70, humidity 0–100, pressure 300–1100, UV 0–30.
- Unknown/revoked credentials and maintenance/retired devices return 401. Malformed JSON/batches return 400, unsupported media 415, oversized payload 413, service failures 503.
- Valid batches return `{accepted: [...], duplicates: [...], rejected: [{id, reason}]}`. HTTP 200 alone does not mean every record was accepted.
- Device/message-ID and device/measurement-time/averaging-period combinations are unique. First write wins; conflicting reused IDs are not allowed to overwrite raw records.
- Rejected records generate operator issues with reasons. Acknowledgement and resolution create timestamped maintenance history.
- On 503 or lost acknowledgement, retry with the same IDs and exponential backoff. Successfully committed records will be reported as duplicates.

## Device lifecycle

Register area → register device → generate credential → provision hardware → transmit readings → administrator publishes the area.

The gateway checks device state before accepting a request. A request already in flight when a device is suspended may complete; suspension prevents subsequent authentication. No database-wide key is exposed in the firmware.

Firmware must preserve queued samples, IDs and measurement times across reconnects. Physical firmware, power-loss recovery and clock synchronization have not yet been verified with a real ESP32.
