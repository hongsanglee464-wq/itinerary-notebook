/** Decode a Google-style encoded polyline into [lat, lng] pairs. */
export function decodePolyline(encoded: string, precision = 5): Array<[number, number]> {
  const factor = 10 ** precision
  const coordinates: Array<[number, number]> = []
  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    const latitudeChange = readChunk(encoded)
    const longitudeChange = readChunk(encoded)
    if (latitudeChange == null || longitudeChange == null) break
    latitude += latitudeChange
    longitude += longitudeChange
    coordinates.push([latitude / factor, longitude / factor])
  }

  return coordinates

  function readChunk(value: string): number | null {
    let result = 0
    let shift = 0
    let byte = 0
    do {
      if (index >= value.length) return null
      byte = value.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
}
