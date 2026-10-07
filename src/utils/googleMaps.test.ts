import { describe, it, expect } from "vitest";
import { coordsFromGoogleMapsUrl, findGoogleMapsLink, googleMapsDirectionsUrl, placeNameFromGoogleMapsUrl } from "./googleMaps";

describe("Google Maps links", () => {
  const full = "https://www.google.com/maps/place/Bayside+Marketplace/@25.7781,-80.1890,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d25.778231!4d-80.187108";

  it("finds a link inside a note", () => {
    expect(findGoogleMapsLink(`Reconocer el puerto ${full} mañana`)).toBe(full);
    expect(findGoogleMapsLink("ver https://maps.app.goo.gl/AbC123 ahí")).toBe("https://maps.app.goo.gl/AbC123");
    expect(findGoogleMapsLink("https://www.booking.com/hotel")).toBeUndefined();
  });

  it("reads the place's own pin before the camera position", () => {
    expect(coordsFromGoogleMapsUrl(full)).toEqual({ lat: 25.778231, lng: -80.187108 });
    expect(coordsFromGoogleMapsUrl("https://www.google.com/maps/@28.37,-81.51,15z")).toEqual({ lat: 28.37, lng: -81.51 });
    expect(coordsFromGoogleMapsUrl("https://maps.google.com/?q=25.08,-77.34")).toEqual({ lat: 25.08, lng: -77.34 });
  });

  it("gives no spot for a link without coordinates", () => {
    expect(coordsFromGoogleMapsUrl("https://www.google.com/maps/place/Disney+Springs/data=!4m2!3m1!1s0x0:0x85a2c311efe17283")).toBeNull();
  });

  it("reads the place name and builds directions", () => {
    expect(placeNameFromGoogleMapsUrl(full)).toBe("Bayside Marketplace");
    expect(googleMapsDirectionsUrl({ lat: 25.7, lng: -80.1 })).toBe("https://www.google.com/maps/dir/?api=1&destination=25.7,-80.1");
  });
});
