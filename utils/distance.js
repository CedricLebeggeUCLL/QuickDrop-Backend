const haversineDistance = (coords1, coords2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // Earth's radius in kilometers
  
    // Normalize coordinates to { lat, lng } format
    const normalizeCoords = (coords) => {
      try {
        if (Array.isArray(coords)) {
          return { lat: coords[0], lng: coords[1] };
        } else if (typeof coords === 'object' && coords !== null) {
          return { lat: coords.lat, lng: coords.lng };
        } else {
          throw new Error('Invalid coordinates format');
        }
      } catch (error) {
        console.error('Error normalizing coordinates:', coords, error.message);
        throw error;
      }
    };
  
    try {
      const c1 = normalizeCoords(coords1);
      const c2 = normalizeCoords(coords2);
  
      const [lat1, lon1] = [c1.lat, c1.lng];
      const [lat2, lon2] = [c2.lat, c2.lng];
  
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
  
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in kilometers
  
      return distance;
    } catch (error) {
      console.error('Error calculating distance:', coords1, coords2, error.message);
      throw error;
    }
  };
  
  module.exports = { haversineDistance };