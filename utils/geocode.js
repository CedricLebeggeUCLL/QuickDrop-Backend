const axios = require('axios');

// Gebruik dezelfde API-sleutel als in AndroidManifest.xml
const GOOGLE_API_KEY = 'AIzaSyBwMjsNiecyBf8YyjiuZBN7Dtizdee4nJY';

const geocodeAddress = async (address) => {
  try {
    const fullAddress = `${address.street_name} ${address.house_number}${address.extra_info ? `, ${address.extra_info}` : ''}, ${address.city}, ${address.postal_code}, ${address.country}`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(url);

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    const location = response.data.results[0].geometry.location;
    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.error(`Error geocoding address ${JSON.stringify(address)}: ${error.message}`);
    throw error;
  }
};

module.exports = { geocodeAddress };