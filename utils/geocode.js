const axios = require('axios');

const GOOGLE_API_KEY = 'AIzaSyBwMjsNiecyBf8YyjiuZBN7Dtizdee4nJY';

// Mapping van landnamen en -codes naar de verwachte landcode
const countryCodeMap = {
  'belgie': 'be',
  'belgium': 'be',
  'be': 'be',
  'belgiË': 'be', // Voor de zekerheid, hoewel we normaliseren
};

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

    // Zoek postcode
    const postalCodeComponent = addressComponents.find(component => component.types.includes('postal_code'));
    const inputPostalCode = address.postal_code?.trim();
    const apiPostalCode = postalCodeComponent?.long_name?.trim();
    const postalCodeMatch = postalCodeComponent && inputPostalCode && apiPostalCode === inputPostalCode;

    // Zoek land en vergelijk landcode (short_name)
    const countryComponent = addressComponents.find(component => component.types.includes('country'));
    const inputCountry = address.country?.trim().toLowerCase().replace(/ë/g, 'e'); // Normaliseer 'België' naar 'belgie'
    const apiCountryCode = countryComponent?.short_name?.toLowerCase(); // Gebruik landcode, zoals 'be'
    const expectedCountryCode = countryCodeMap[inputCountry] || inputCountry; // Gebruik mapping of fallback naar invoer
    const countryMatch = countryComponent && apiCountryCode && apiCountryCode === expectedCountryCode;

    if (!postalCodeMatch || !countryMatch) {
      throw new Error(
        `Invalid address: ${fullAddress} - Postcode or country mismatch (Postcode: ${apiPostalCode} vs ${inputPostalCode}, Country code: ${apiCountryCode} vs ${expectedCountryCode})`
      );
    }

    const location = result.geometry.location;
    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.error(`Error geocoding address ${JSON.stringify(address)}: ${error.message}`);
    throw error;
  }
};

module.exports = { geocodeAddress };