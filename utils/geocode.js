const axios = require('axios');

const GOOGLE_API_KEY = 'AIzaSyBwMjsNiecyBf8YyjiuZBN7Dtizdee4nJY'; // Vervang door je eigen API-sleutel

const geocodeAddress = async (address) => {
  try {
    const fullAddress = `${address.street_name} ${address.house_number}${address.extra_info ? `, ${address.extra_info}` : ''}, ${address.postal_code}, ${address.city || ''}, ${address.country || ''}`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(url);

    console.log(`Geocoding response for ${fullAddress}:`, JSON.stringify(response.data, null, 2));

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    const result = response.data.results[0];
    const addressComponents = result.address_components;
    const postalCodeComponent = addressComponents.find(component => component.types.includes('postal_code'));
    const countryMatch = addressComponents.find(component => component.types.includes('country') && component.long_name.toLowerCase() === (address.country || '').toLowerCase());

    const postalCodeMatch = postalCodeComponent && (postalCodeComponent.long_name.includes(address.postal_code) || address.postal_code.includes(postalCodeComponent?.long_name));

    if (!postalCodeMatch || !countryMatch) {
      throw new Error(`Invalid address: ${fullAddress} - Postcode or country mismatch`);
    }

    const location = result.geometry.location;
    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.error(`Error geocoding address ${JSON.stringify(address)}: ${error.message}`);
    throw error;
  }
};

module.exports = { geocodeAddress };