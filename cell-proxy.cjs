// Cell Tower Proxy for OpenCelliD API
// Run with: node cell-proxy.cjs
// Listens on port 4011

require('dotenv').config();

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 4011;
const OPENCELLID_TOKEN = process.env.OPENCELLID_TOKEN;

if (!OPENCELLID_TOKEN) {
  console.error('[Cell] ERROR: OPENCELLID_TOKEN not set in environment or .env file');
  process.exit(1);
}

// Simple in-memory cache (cell data is fairly static)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// MCC/MNC to carrier name mapping (US carriers)
const US_CARRIERS = {
  '310-410': { name: 'AT&T', bands: ['B2', 'B4', 'B5', 'B12', 'B14', 'B17', 'B29', 'B30', 'B66', 'n5', 'n77', 'n260'] },
  '310-260': { name: 'T-Mobile', bands: ['B2', 'B4', 'B12', 'B66', 'B71', 'n41', 'n71', 'n258', 'n260', 'n261'] },
  '311-480': { name: 'Verizon', bands: ['B2', 'B4', 'B5', 'B13', 'B66', 'n2', 'n5', 'n77', 'n261'] },
  '310-120': { name: 'Sprint (T-Mobile)', bands: ['B25', 'B26', 'B41', 'n41'] },
  '311-490': { name: 'Verizon LTE', bands: ['B4', 'B13'] },
  '312-530': { name: 'Sprint (T-Mobile)', bands: ['B25', 'B41'] },
  '310-150': { name: 'AT&T', bands: ['B2', 'B4', 'B5', 'B12', 'B17'] },
  '311-882': { name: 'AT&T FirstNet', bands: ['B14'] },
  '310-030': { name: 'AT&T', bands: ['B2', 'B4', 'B5'] },
  '310-070': { name: 'AT&T', bands: ['B2', 'B4', 'B5'] },
  '310-560': { name: 'US Cellular', bands: ['B2', 'B4', 'B5', 'B12', 'n71'] },
  '311-220': { name: 'US Cellular', bands: ['B2', 'B4', 'B5', 'B12'] },
  '310-990': { name: 'Inland Cellular', bands: ['B2', 'B4', 'B12'] },
  '312-250': { name: 'Cellular One', bands: ['B4', 'B12'] }
};

// International carriers with typical bands
const INTL_CARRIERS = {
  // Russia (MCC 250)
  '250-1': { name: 'MTS Russia', bands: ['B3', 'B7', 'B20', 'B38', 'n79'] },
  '250-2': { name: 'MegaFon', bands: ['B1', 'B3', 'B7', 'B20', 'B38', 'n79'] },
  '250-99': { name: 'Beeline Russia', bands: ['B3', 'B7', 'B20', 'B38'] },
  '250-20': { name: 'Tele2 Russia', bands: ['B3', 'B7', 'B38'] },
  '250-11': { name: 'Yota', bands: ['B7', 'B38'] },
  '250-19': { name: 'Tattelecom', bands: ['B7', 'B38'] },
  
  // UK (MCC 234)
  '234-10': { name: 'O2 UK', bands: ['B1', 'B3', 'B8', 'B20', 'B40', 'n78'] },
  '234-15': { name: 'Vodafone UK', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '234-20': { name: 'Three UK', bands: ['B1', 'B3', 'B20', 'n78'] },
  '234-30': { name: 'EE UK', bands: ['B1', 'B3', 'B7', 'B20', 'B38', 'n78'] },
  '234-33': { name: 'EE UK', bands: ['B1', 'B3', 'B7', 'B20', 'B38', 'n78'] },
  
  // Germany (MCC 262)
  '262-1': { name: 'Telekom DE', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B28', 'n78'] },
  '262-2': { name: 'Vodafone DE', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '262-3': { name: 'O2 Germany', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '262-7': { name: 'O2 Germany', bands: ['B1', 'B3', 'B7', 'B8', 'B20'] },
  
  // France (MCC 208)
  '208-1': { name: 'Orange FR', bands: ['B1', 'B3', 'B7', 'B20', 'B28', 'n78'] },
  '208-10': { name: 'SFR', bands: ['B1', 'B3', 'B7', 'B20', 'B28', 'n78'] },
  '208-15': { name: 'Free Mobile', bands: ['B3', 'B7', 'B28', 'n700'] },
  '208-20': { name: 'Bouygues', bands: ['B1', 'B3', 'B7', 'B20', 'B28', 'n78'] },
  
  // Japan (MCC 440)
  '440-10': { name: 'NTT Docomo', bands: ['B1', 'B3', 'B19', 'B21', 'B28', 'B42', 'n78', 'n79', 'n257'] },
  '440-20': { name: 'SoftBank JP', bands: ['B1', 'B3', 'B8', 'B11', 'B28', 'B42', 'n77'] },
  '440-50': { name: 'au KDDI', bands: ['B1', 'B11', 'B18', 'B26', 'B28', 'B42', 'n77', 'n78'] },
  '440-51': { name: 'au KDDI', bands: ['B1', 'B18', 'B26', 'B28', 'B42'] },
  '441-0': { name: 'Rakuten Mobile', bands: ['B3', 'B18', 'n77'] },
  
  // South Korea (MCC 450)
  '450-5': { name: 'SK Telecom', bands: ['B1', 'B3', 'B5', 'B8', 'B26', 'n78', 'n257'] },
  '450-8': { name: 'KT Korea', bands: ['B1', 'B3', 'B5', 'B8', 'n78', 'n257'] },
  '450-6': { name: 'LG U+', bands: ['B1', 'B3', 'B5', 'B7', 'n78', 'n257'] },
  
  // Australia (MCC 505)
  '505-1': { name: 'Telstra', bands: ['B1', 'B3', 'B5', 'B7', 'B28', 'B40', 'n78'] },
  '505-2': { name: 'Optus', bands: ['B1', 'B3', 'B7', 'B28', 'B40', 'n78'] },
  '505-3': { name: 'Vodafone AU', bands: ['B1', 'B3', 'B5', 'B8', 'B28', 'n78'] },
  
  // Canada (MCC 302)
  '302-220': { name: 'Telus', bands: ['B2', 'B4', 'B5', 'B7', 'B12', 'B13', 'B17', 'B29', 'n78'] },
  '302-221': { name: 'Telus', bands: ['B2', 'B4', 'B5', 'B7', 'B12'] },
  '302-370': { name: 'Rogers', bands: ['B2', 'B4', 'B5', 'B7', 'B12', 'B17', 'B29', 'B66', 'n78'] },
  '302-720': { name: 'Rogers', bands: ['B2', 'B4', 'B7', 'B12', 'B17', 'B29'] },
  '302-610': { name: 'Bell Canada', bands: ['B2', 'B4', 'B5', 'B7', 'B12', 'B13', 'B17', 'B29', 'n78'] },
  
  // Mexico (MCC 334)
  '334-20': { name: 'Telcel', bands: ['B2', 'B4', 'B5', 'B7', 'B28', 'B66'] },
  '334-30': { name: 'Movistar MX', bands: ['B2', 'B4', 'B5', 'B7', 'B28'] },
  '334-50': { name: 'AT&T Mexico', bands: ['B2', 'B4', 'B5', 'B7', 'B66'] },
  
  // UAE (MCC 424)
  '424-2': { name: 'Etisalat', bands: ['B1', 'B3', 'B7', 'B20', 'B38', 'B40', 'n78'] },
  '424-3': { name: 'du UAE', bands: ['B1', 'B3', 'B7', 'B38', 'B40', 'n78'] },
  
  // Saudi Arabia (MCC 420)
  '420-1': { name: 'STC', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B38', 'B40', 'n78'] },
  '420-3': { name: 'Mobily', bands: ['B1', 'B3', 'B7', 'B38', 'B40', 'n78'] },
  '420-4': { name: 'Zain SA', bands: ['B1', 'B3', 'B8', 'B38', 'B40'] },
  
  // Kuwait (MCC 419)
  '419-2': { name: 'Zain Kuwait', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '419-3': { name: 'Ooredoo Kuwait', bands: ['B1', 'B3', 'B7', 'B8', 'n78'] },
  '419-4': { name: 'STC Kuwait', bands: ['B1', 'B3', 'B7', 'n78'] },
  
  // Qatar (MCC 427)
  '427-1': { name: 'Ooredoo Qatar', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B38', 'n78'] },
  '427-2': { name: 'Vodafone Qatar', bands: ['B1', 'B3', 'B7', 'B8', 'B38', 'n78'] },
  
  // Bahrain (MCC 426)
  '426-1': { name: 'Batelco', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  '426-2': { name: 'Zain Bahrain', bands: ['B1', 'B3', 'B7', 'B8', 'n78'] },
  '426-4': { name: 'STC Bahrain', bands: ['B1', 'B3', 'B7'] },
  
  // Iraq (MCC 418)
  '418-5': { name: 'Asia Cell', bands: ['B1', 'B3', 'B8'] },
  '418-20': { name: 'Zain Iraq', bands: ['B1', 'B3', 'B8', 'B20'] },
  '418-30': { name: 'Korek', bands: ['B1', 'B3', 'B8'] },
  '418-40': { name: 'Fanoos', bands: ['B3', 'B8'] },
  
  // Jordan (MCC 416)
  '416-1': { name: 'Zain Jordan', bands: ['B1', 'B3', 'B7', 'B8', 'B20'] },
  '416-3': { name: 'Umniah', bands: ['B1', 'B3', 'B7', 'B8'] },
  '416-77': { name: 'Orange Jordan', bands: ['B1', 'B3', 'B7', 'B8', 'B20'] },
  
  // Israel (MCC 425)
  '425-1': { name: 'Partner', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '425-2': { name: 'Cellcom', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  '425-3': { name: 'Pelephone', bands: ['B1', 'B3', 'B7', 'B8', 'n78'] },
  
  // Egypt (MCC 602)
  '602-1': { name: 'Orange Egypt', bands: ['B1', 'B3', 'B8', 'B40'] },
  '602-2': { name: 'Vodafone Egypt', bands: ['B1', 'B3', 'B8'] },
  '602-3': { name: 'Etisalat Egypt', bands: ['B1', 'B3', 'B8', 'B40'] },
  '602-4': { name: 'WE Egypt', bands: ['B1', 'B3', 'B8', 'B40'] },
  
  // Philippines (MCC 515)
  '515-2': { name: 'Globe PH', bands: ['B1', 'B3', 'B5', 'B7', 'B8', 'B28', 'B40'] },
  '515-3': { name: 'Smart PH', bands: ['B1', 'B3', 'B5', 'B7', 'B28', 'B40'] },
  '515-18': { name: 'DITO PH', bands: ['B1', 'B3', 'B5', 'B28', 'n78'] },
  
  // Thailand (MCC 520)
  '520-1': { name: 'AIS Thailand', bands: ['B1', 'B3', 'B8', 'B26', 'B40', 'n28', 'n78'] },
  '520-3': { name: 'AIS Thailand', bands: ['B1', 'B3', 'B8', 'B40'] },
  '520-4': { name: 'TrueMove', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  '520-5': { name: 'dtac', bands: ['B1', 'B3', 'B28', 'n28'] },
  
  // Vietnam (MCC 452)
  '452-1': { name: 'MobiFone', bands: ['B1', 'B3', 'B7', 'B8'] },
  '452-2': { name: 'Vinaphone', bands: ['B1', 'B3', 'B7', 'B8'] },
  '452-4': { name: 'Viettel', bands: ['B1', 'B3', 'B7', 'B8', 'B40'] },
  
  // Singapore (MCC 525)
  '525-1': { name: 'Singtel', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'B40', 'n78'] },
  '525-3': { name: 'M1 Singapore', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  '525-5': { name: 'StarHub', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  
  // Malaysia (MCC 502)
  '502-12': { name: 'Maxis', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'B40', 'n78'] },
  '502-13': { name: 'Celcom', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  '502-16': { name: 'Digi', bands: ['B1', 'B3', 'B7', 'B8', 'B28'] },
  '502-19': { name: 'U Mobile', bands: ['B1', 'B3', 'B7', 'B8', 'B28'] },
  
  // Indonesia (MCC 510)
  '510-1': { name: 'Indosat', bands: ['B1', 'B3', 'B5', 'B8', 'B40'] },
  '510-10': { name: 'Telkomsel', bands: ['B1', 'B3', 'B5', 'B8', 'B40', 'n78'] },
  '510-11': { name: 'XL Axiata', bands: ['B1', 'B3', 'B5', 'B8'] },
  '510-89': { name: 'Three ID', bands: ['B1', 'B3', 'B8', 'B40'] },
  
  // Italy (MCC 222)
  '222-1': { name: 'TIM Italy', bands: ['B1', 'B3', 'B7', 'B20', 'B32', 'n78'] },
  '222-10': { name: 'Vodafone IT', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  '222-50': { name: 'Iliad IT', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  '222-88': { name: 'Wind Tre', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  
  // Spain (MCC 214)
  '214-1': { name: 'Vodafone ES', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '214-3': { name: 'Orange ES', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  '214-4': { name: 'Yoigo', bands: ['B1', 'B3', 'B7', 'B20'] },
  '214-7': { name: 'Movistar ES', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  
  // Poland (MCC 260)
  '260-1': { name: 'Plus PL', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B38', 'n78'] },
  '260-2': { name: 'T-Mobile PL', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '260-3': { name: 'Orange PL', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  '260-6': { name: 'Play PL', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  
  // Romania (MCC 226)
  '226-1': { name: 'Vodafone RO', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '226-3': { name: 'Telekom RO', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '226-10': { name: 'Orange RO', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  
  // Turkey (MCC 286)
  '286-1': { name: 'Turkcell', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B38', 'n78'] },
  '286-2': { name: 'Vodafone TR', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '286-3': { name: 'Turk Telekom', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  
  // Greece (MCC 202)
  '202-1': { name: 'Cosmote', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '202-5': { name: 'Vodafone GR', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '202-10': { name: 'Wind GR', bands: ['B1', 'B3', 'B7', 'B8', 'B20'] },
  
  // India (MCC 404, 405)
  '404-10': { name: 'Airtel IN', bands: ['B1', 'B3', 'B5', 'B8', 'B40', 'B41', 'n78'] },
  '404-45': { name: 'Airtel IN', bands: ['B1', 'B3', 'B5', 'B8', 'B40', 'B41'] },
  '404-86': { name: 'Vodafone-Idea', bands: ['B1', 'B3', 'B5', 'B8', 'B40', 'B41'] },
  '405-857': { name: 'Jio', bands: ['B3', 'B5', 'B40', 'n78', 'n258'] },
  '405-858': { name: 'Jio', bands: ['B3', 'B5', 'B40', 'n78'] },
  '404-11': { name: 'Vodafone-Idea', bands: ['B1', 'B3', 'B5', 'B8', 'B40'] },
  '404-20': { name: 'Vodafone-Idea', bands: ['B1', 'B3', 'B5', 'B8', 'B40'] },
  
  // China (MCC 460)
  '460-0': { name: 'China Mobile', bands: ['B1', 'B3', 'B8', 'B34', 'B39', 'B40', 'B41', 'n41', 'n78', 'n79'] },
  '460-1': { name: 'China Unicom', bands: ['B1', 'B3', 'B8', 'B40', 'B41', 'n78'] },
  '460-11': { name: 'China Telecom', bands: ['B1', 'B3', 'B5', 'B41', 'n78'] },
  
  // Taiwan (MCC 466)
  '466-1': { name: 'Far EasTone', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  '466-5': { name: 'Asia Pacific', bands: ['B1', 'B3', 'B8', 'B28', 'n78'] },
  '466-11': { name: 'Chunghwa', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  '466-89': { name: 'T Star', bands: ['B3', 'B8', 'B28', 'n78'] },
  '466-92': { name: 'Chunghwa', bands: ['B1', 'B3', 'B7', 'B8', 'n78'] },
  '466-93': { name: 'Taiwan Mobile', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  
  // Hong Kong (MCC 454)
  '454-0': { name: '1O1O/CSL', bands: ['B1', 'B3', 'B7', 'B8', 'B40', 'n78'] },
  '454-6': { name: 'SmarTone HK', bands: ['B1', 'B3', 'B7', 'B8', 'B40', 'n78'] },
  '454-12': { name: 'China Mobile HK', bands: ['B1', 'B3', 'B7', 'B8', 'B40', 'n78'] },
  '454-16': { name: 'PCCW-HKT', bands: ['B1', 'B3', 'B7', 'B8', 'B40', 'n78'] },
  '454-19': { name: 'PCCW-HKT', bands: ['B1', 'B3', 'B7', 'B8', 'B40', 'n78'] },
  
  // Pakistan (MCC 410)
  '410-1': { name: 'Jazz', bands: ['B1', 'B3', 'B8', 'B40'] },
  '410-3': { name: 'Ufone', bands: ['B1', 'B3', 'B8'] },
  '410-4': { name: 'Zong', bands: ['B1', 'B3', 'B8', 'B40', 'B41'] },
  '410-6': { name: 'Telenor PK', bands: ['B1', 'B3', 'B8'] },
  
  // Afghanistan (MCC 412)
  '412-1': { name: 'AWCC', bands: ['B3', 'B8'] },
  '412-20': { name: 'Roshan', bands: ['B3', 'B8'] },
  '412-40': { name: 'MTN AF', bands: ['B3', 'B8'] },
  '412-50': { name: 'Etisalat AF', bands: ['B3', 'B8'] },
  
  // Kenya (MCC 639)
  '639-2': { name: 'Safaricom', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B28'] },
  '639-3': { name: 'Airtel Kenya', bands: ['B1', 'B3', 'B7', 'B8'] },
  '639-7': { name: 'Telkom Kenya', bands: ['B3', 'B7', 'B8'] },
  
  // South Africa (MCC 655)
  '655-1': { name: 'Vodacom ZA', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  '655-2': { name: 'Telkom ZA', bands: ['B1', 'B3', 'B7', 'B8'] },
  '655-7': { name: 'Cell C', bands: ['B1', 'B3', 'B7', 'B8'] },
  '655-10': { name: 'MTN ZA', bands: ['B1', 'B3', 'B7', 'B8', 'B28', 'n78'] },
  
  // Nigeria (MCC 621)
  '621-20': { name: 'Airtel NG', bands: ['B3', 'B8'] },
  '621-30': { name: 'MTN Nigeria', bands: ['B3', 'B7', 'B8'] },
  '621-50': { name: 'Glo Nigeria', bands: ['B3', 'B8'] },
  '621-60': { name: '9mobile', bands: ['B3', 'B8'] },
  // Liberia (MCC 618)
  '618-1': { name: 'Lonestar Cell', bands: ['B3', 'B8'] },
  '618-2': { name: 'Libercell', bands: ['B3', 'B8'] },
  '618-4': { name: 'Comium Liberia', bands: ['B3', 'B8'] },
  '618-7': { name: 'Orange Liberia', bands: ['B3', 'B8'] },
  '618-20': { name: 'LIBTELCO', bands: ['B3', 'B8'] },

  // Sierra Leone (MCC 619)
  '619-1': { name: 'Airtel SL', bands: ['B3', 'B8'] },
  '619-2': { name: 'Africell SL', bands: ['B3', 'B8'] },
  '619-3': { name: 'Comium SL', bands: ['B3', 'B8'] },
  '619-5': { name: 'Africell SL', bands: ['B3', 'B8'] },
  '619-25': { name: 'Orange SL', bands: ['B3', 'B8'] },

  // Ghana (MCC 620)
  '620-1': { name: 'MTN Ghana', bands: ['B3', 'B7', 'B8', 'B20'] },
  '620-2': { name: 'Vodafone Ghana', bands: ['B3', 'B7', 'B8'] },
  '620-3': { name: 'AirtelTigo', bands: ['B3', 'B8'] },
  '620-4': { name: 'Expresso Ghana', bands: ['B3', 'B8'] },
  '620-6': { name: 'AirtelTigo', bands: ['B3', 'B8'] },
  '620-7': { name: 'Globacom Ghana', bands: ['B3', 'B8'] },

  // Gambia (MCC 607)
  '607-1': { name: 'Gamcel', bands: ['B3', 'B8'] },
  '607-2': { name: 'Africell GM', bands: ['B3', 'B8'] },
  '607-3': { name: 'Comium GM', bands: ['B3', 'B8'] },
  '607-4': { name: 'QCell', bands: ['B3', 'B8'] },

  // Senegal (MCC 608)
  '608-1': { name: 'Orange Senegal', bands: ['B3', 'B7', 'B8', 'B20'] },
  '608-2': { name: 'Free Senegal', bands: ['B3', 'B8'] },
  '608-3': { name: 'Expresso SN', bands: ['B3', 'B8'] },

  // Mauritania (MCC 609)
  '609-1': { name: 'Mattel', bands: ['B3', 'B8'] },
  '609-2': { name: 'Chinguitel', bands: ['B3', 'B8'] },
  '609-10': { name: 'Mauritel', bands: ['B3', 'B8'] },

  // Mali (MCC 610)
  '610-1': { name: 'Malitel', bands: ['B3', 'B8'] },
  '610-2': { name: 'Orange Mali', bands: ['B3', 'B8'] },
  '610-3': { name: 'Telecel Mali', bands: ['B3', 'B8'] },

  // Guinea (MCC 611)
  '611-1': { name: 'Orange Guinea', bands: ['B3', 'B8'] },
  '611-2': { name: 'Sotelgui', bands: ['B3', 'B8'] },
  '611-3': { name: 'Telecel Guinea', bands: ['B3', 'B8'] },
  '611-4': { name: 'MTN Guinea', bands: ['B3', 'B8'] },
  '611-5': { name: 'Cellcom Guinea', bands: ['B3', 'B8'] },

  // Ivory Coast (MCC 612)
  '612-1': { name: 'Cora de Comstar', bands: ['B3', 'B8'] },
  '612-2': { name: 'Moov CI', bands: ['B3', 'B8'] },
  '612-3': { name: 'Orange CI', bands: ['B3', 'B7', 'B8'] },
  '612-4': { name: 'KoZ', bands: ['B3', 'B8'] },
  '612-5': { name: 'MTN CI', bands: ['B3', 'B7', 'B8'] },
  '612-6': { name: 'GreenN', bands: ['B3', 'B8'] },

  // Burkina Faso (MCC 613)
  '613-1': { name: 'Onatel', bands: ['B3', 'B8'] },
  '613-2': { name: 'Orange BF', bands: ['B3', 'B8'] },
  '613-3': { name: 'Telecel BF', bands: ['B3', 'B8'] },

  // Niger (MCC 614)
  '614-1': { name: 'SahelCom', bands: ['B3', 'B8'] },
  '614-2': { name: 'Airtel Niger', bands: ['B3', 'B8'] },
  '614-3': { name: 'Moov Niger', bands: ['B3', 'B8'] },
  '614-4': { name: 'Orange Niger', bands: ['B3', 'B8'] },

  // Togo (MCC 615)
  '615-1': { name: 'Togo Telecom', bands: ['B3', 'B8'] },
  '615-2': { name: 'Moov Togo', bands: ['B3', 'B8'] },
  '615-3': { name: 'TogoCel', bands: ['B3', 'B8'] },

  // Benin (MCC 616)
  '616-1': { name: 'Libercom', bands: ['B3', 'B8'] },
  '616-2': { name: 'Moov Benin', bands: ['B3', 'B8'] },
  '616-3': { name: 'MTN Benin', bands: ['B3', 'B8'] },
  '616-4': { name: 'BBCOM', bands: ['B3', 'B8'] },
  '616-5': { name: 'Glo Benin', bands: ['B3', 'B8'] },

  // Mauritius (MCC 617)
  '617-1': { name: 'Orange MU', bands: ['B3', 'B7', 'B8'] },
  '617-2': { name: 'MTML', bands: ['B3', 'B8'] },
  '617-10': { name: 'Emtel', bands: ['B3', 'B7', 'B8'] },

  // Chad (MCC 622)
  '622-1': { name: 'Airtel Chad', bands: ['B3', 'B8'] },
  '622-2': { name: 'Tigo Chad', bands: ['B3', 'B8'] },
  '622-3': { name: 'Salam Chad', bands: ['B3', 'B8'] },
  '622-4': { name: 'Sotel Chad', bands: ['B3', 'B8'] },

  // Central African Republic (MCC 623)
  '623-1': { name: 'Centrafrique Tel', bands: ['B3', 'B8'] },
  '623-2': { name: 'Telecel CAR', bands: ['B3', 'B8'] },
  '623-3': { name: 'Orange CAR', bands: ['B3', 'B8'] },
  '623-4': { name: 'Nationlink CAR', bands: ['B3', 'B8'] },

  // Cameroon (MCC 624)
  '624-1': { name: 'MTN Cameroon', bands: ['B3', 'B7', 'B8'] },
  '624-2': { name: 'Orange Cameroon', bands: ['B3', 'B7', 'B8'] },
  '624-4': { name: 'Nexttel', bands: ['B3', 'B8'] },

  // Cape Verde (MCC 625)
  '625-1': { name: 'CVMovel', bands: ['B3', 'B8'] },
  '625-2': { name: 'T+ Telecom', bands: ['B3', 'B8'] },

  // Sao Tome (MCC 626)
  '626-1': { name: 'CSTmovel', bands: ['B3', 'B8'] },

  // Equatorial Guinea (MCC 627)
  '627-1': { name: 'Orange GQ', bands: ['B3', 'B8'] },
  '627-3': { name: 'Muni', bands: ['B3', 'B8'] },

  // Gabon (MCC 628)
  '628-1': { name: 'Libertis', bands: ['B3', 'B8'] },
  '628-2': { name: 'Moov Gabon', bands: ['B3', 'B8'] },
  '628-3': { name: 'Airtel Gabon', bands: ['B3', 'B8'] },
  '628-4': { name: 'Azur Gabon', bands: ['B3', 'B8'] },

  // Congo Republic (MCC 629)
  '629-1': { name: 'Airtel Congo', bands: ['B3', 'B8'] },
  '629-7': { name: 'Warid Congo', bands: ['B3', 'B8'] },
  '629-10': { name: 'MTN Congo', bands: ['B3', 'B8'] },

  // DR Congo (MCC 630)
  '630-1': { name: 'Vodacom DRC', bands: ['B3', 'B8'] },
  '630-2': { name: 'Airtel DRC', bands: ['B3', 'B8'] },
  '630-4': { name: 'Cellco', bands: ['B3', 'B8'] },
  '630-5': { name: 'Supercell', bands: ['B3', 'B8'] },
  '630-86': { name: 'Orange DRC', bands: ['B3', 'B8'] },
  '630-89': { name: 'Tigo DRC', bands: ['B3', 'B8'] },

  // Angola (MCC 631)
  '631-2': { name: 'Unitel Angola', bands: ['B3', 'B7', 'B8'] },
  '631-4': { name: 'Movicel', bands: ['B3', 'B8'] },

  // Guinea-Bissau (MCC 632)
  '632-1': { name: 'Guinetel', bands: ['B3', 'B8'] },
  '632-2': { name: 'MTN Bissau', bands: ['B3', 'B8'] },
  '632-3': { name: 'Orange Bissau', bands: ['B3', 'B8'] },

  // Seychelles (MCC 633)
  '633-1': { name: 'Cable & Wireless SC', bands: ['B3', 'B8'] },
  '633-2': { name: 'Mediatech', bands: ['B3', 'B8'] },
  '633-10': { name: 'Airtel SC', bands: ['B3', 'B8'] },

  // Rwanda (MCC 635)
  '635-10': { name: 'MTN Rwanda', bands: ['B3', 'B7', 'B8', 'B28'] },
  '635-12': { name: 'Airtel Rwanda', bands: ['B3', 'B8'] },
  '635-13': { name: 'Tigo Rwanda', bands: ['B3', 'B8'] },
  '635-14': { name: 'Airtel Rwanda', bands: ['B3', 'B8'] },
  '635-17': { name: 'Olleh Rwanda', bands: ['B3', 'B8'] },

  // Ethiopia (MCC 636)
  '636-1': { name: 'Ethio Telecom', bands: ['B3', 'B8', 'B28'] },
  '636-2': { name: 'Safaricom ET', bands: ['B3', 'B8'] },

  // Tanzania (MCC 640)
  '640-2': { name: 'Tigo Tanzania', bands: ['B3', 'B8'] },
  '640-3': { name: 'Zantel', bands: ['B3', 'B8'] },
  '640-4': { name: 'Vodacom TZ', bands: ['B3', 'B7', 'B8'] },
  '640-5': { name: 'Airtel TZ', bands: ['B3', 'B8'] },
  '640-6': { name: 'Sasatel', bands: ['B3', 'B8'] },
  '640-7': { name: 'TTCL', bands: ['B3', 'B8'] },
  '640-8': { name: 'Benson Online', bands: ['B3', 'B8'] },
  '640-9': { name: 'Halotel', bands: ['B3', 'B8'] },
  '640-11': { name: 'SmileCom', bands: ['B3', 'B8'] },

  // Uganda (MCC 641)
  '641-1': { name: 'Airtel Uganda', bands: ['B3', 'B8'] },
  '641-6': { name: 'Africell UG', bands: ['B3', 'B8'] },
  '641-10': { name: 'MTN Uganda', bands: ['B3', 'B7', 'B8'] },
  '641-11': { name: 'Uganda Telecom', bands: ['B3', 'B8'] },
  '641-14': { name: 'Africell UG', bands: ['B3', 'B8'] },
  '641-18': { name: 'Smart Uganda', bands: ['B3', 'B8'] },
  '641-22': { name: 'Airtel Uganda', bands: ['B3', 'B8'] },
  '641-33': { name: 'Smile UG', bands: ['B3', 'B8'] },
  '641-66': { name: 'i-Tel UG', bands: ['B3', 'B8'] },

  // Burundi (MCC 642)
  '642-1': { name: 'Spacetel', bands: ['B3', 'B8'] },
  '642-2': { name: 'Africell BI', bands: ['B3', 'B8'] },
  '642-3': { name: 'Onatel', bands: ['B3', 'B8'] },
  '642-7': { name: 'Smart Burundi', bands: ['B3', 'B8'] },
  '642-8': { name: 'Lumitel', bands: ['B3', 'B8'] },
  '642-82': { name: 'Econet Leo', bands: ['B3', 'B8'] },

  // Mozambique (MCC 643)
  '643-1': { name: 'mCel', bands: ['B3', 'B8'] },
  '643-3': { name: 'Movitel', bands: ['B3', 'B8'] },
  '643-4': { name: 'Vodacom MZ', bands: ['B3', 'B7', 'B8'] },

  // Zambia (MCC 645)
  '645-1': { name: 'Airtel Zambia', bands: ['B3', 'B8'] },
  '645-2': { name: 'MTN Zambia', bands: ['B3', 'B7', 'B8'] },
  '645-3': { name: 'Zamtel', bands: ['B3', 'B8'] },

  // Madagascar (MCC 646)
  '646-1': { name: 'Airtel MG', bands: ['B3', 'B8'] },
  '646-2': { name: 'Orange MG', bands: ['B3', 'B8'] },
  '646-3': { name: 'Sacel', bands: ['B3', 'B8'] },
  '646-4': { name: 'Telma', bands: ['B3', 'B8'] },

  // Reunion (MCC 647)
  '647-0': { name: 'Orange Reunion', bands: ['B3', 'B7', 'B8', 'B20'] },
  '647-2': { name: 'SFR Reunion', bands: ['B3', 'B7', 'B8'] },
  '647-10': { name: 'Free Reunion', bands: ['B3', 'B7'] },

  // Zimbabwe (MCC 648)
  '648-1': { name: 'Net*One', bands: ['B3', 'B8'] },
  '648-3': { name: 'Telecel ZW', bands: ['B3', 'B8'] },
  '648-4': { name: 'Econet ZW', bands: ['B3', 'B7', 'B8'] },

  // Namibia (MCC 649)
  '649-1': { name: 'MTC Namibia', bands: ['B3', 'B7', 'B8'] },
  '649-2': { name: 'Telecom Namibia', bands: ['B3', 'B8'] },
  '649-3': { name: 'Paratus Telecom', bands: ['B3', 'B8'] },

  // Malawi (MCC 650)
  '650-1': { name: 'TNM', bands: ['B3', 'B8'] },
  '650-10': { name: 'Airtel Malawi', bands: ['B3', 'B8'] },

  // Lesotho (MCC 651)
  '651-1': { name: 'Vodacom Lesotho', bands: ['B3', 'B8'] },
  '651-2': { name: 'Econet Lesotho', bands: ['B3', 'B8'] },

  // Botswana (MCC 652)
  '652-1': { name: 'Mascom', bands: ['B3', 'B7', 'B8'] },
  '652-2': { name: 'Orange BW', bands: ['B3', 'B8'] },
  '652-4': { name: 'beMobile', bands: ['B3', 'B8'] },

  // Eswatini (MCC 653)
  '653-1': { name: 'Eswatini MTN', bands: ['B3', 'B8'] },
  '653-2': { name: 'Swazi Mobile', bands: ['B3', 'B8'] },
  '653-10': { name: 'Eswatini Mobile', bands: ['B3', 'B8'] },

  // Comoros (MCC 654)
  '654-1': { name: 'Comores Telecom', bands: ['B3', 'B8'] },
  '654-2': { name: 'Telma Comoros', bands: ['B3', 'B8'] },

  // Eritrea (MCC 657)
  '657-1': { name: 'Eritel', bands: ['B3', 'B8'] },

  // South Sudan (MCC 659)
  '659-2': { name: 'MTN South Sudan', bands: ['B3', 'B8'] },
  '659-3': { name: 'Gemtel', bands: ['B3', 'B8'] },
  '659-4': { name: 'Vivacell', bands: ['B3', 'B8'] },
  '659-6': { name: 'Zain SS', bands: ['B3', 'B8'] },
  
  // New Zealand (MCC 530)
  '530-1': { name: 'Vodafone NZ', bands: ['B1', 'B3', 'B7', 'B28', 'n78'] },
  '530-5': { name: 'Spark NZ', bands: ['B1', 'B3', 'B7', 'B28', 'n78'] },
  '530-24': { name: '2degrees', bands: ['B1', 'B3', 'B7', 'B28', 'n78'] },
  
  // Norway (MCC 242)
  '242-1': { name: 'Telenor NO', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B28', 'n78'] },
  '242-2': { name: 'Telia NO', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '242-12': { name: 'ICE NO', bands: ['B3', 'B7', 'B20'] },
  
  // Sweden (MCC 240)
  '240-1': { name: 'Telia SE', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B28', 'n78'] },
  '240-2': { name: '3 Sweden', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  '240-7': { name: 'Telenor SE', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  
  // Finland (MCC 244)
  '244-5': { name: 'Elisa', bands: ['B1', 'B3', 'B7', 'B20', 'B28', 'n78'] },
  '244-10': { name: 'DNA', bands: ['B1', 'B3', 'B7', 'B20', 'B28', 'n78'] },
  '244-91': { name: 'Telia FI', bands: ['B1', 'B3', 'B7', 'B20', 'B28', 'n78'] },
  
  // Denmark (MCC 238)
  '238-1': { name: 'TDC', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '238-2': { name: 'Telenor DK', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '238-6': { name: '3 Denmark', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  
  // Netherlands (MCC 204)
  '204-4': { name: 'Vodafone NL', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '204-8': { name: 'KPN', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '204-16': { name: 'T-Mobile NL', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  
  // Belgium (MCC 206)
  '206-1': { name: 'Proximus', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '206-10': { name: 'Orange BE', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '206-20': { name: 'Telenet', bands: ['B1', 'B3', 'B7', 'B20'] },
  
  // Switzerland (MCC 228)
  '228-1': { name: 'Swisscom', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B28', 'n78'] },
  '228-2': { name: 'Sunrise', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B28', 'n78'] },
  '228-3': { name: 'Salt', bands: ['B1', 'B3', 'B7', 'B20', 'B28'] },
  
  // Austria (MCC 232)
  '232-1': { name: 'A1 Austria', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'B28', 'n78'] },
  '232-3': { name: 'Magenta AT', bands: ['B1', 'B3', 'B7', 'B8', 'B20', 'n78'] },
  '232-5': { name: '3 Austria', bands: ['B1', 'B3', 'B7', 'B20', 'n78'] },
  
  // Ukraine (MCC 255)
  '255-1': { name: 'Kyivstar', bands: ['B1', 'B3', 'B7', 'B8', 'B20'] },
  '255-2': { name: 'Vodafone UA', bands: ['B1', 'B3', 'B7', 'B8', 'B20'] },
  '255-6': { name: 'lifecell', bands: ['B1', 'B3', 'B7', 'B8'] },
  
  // Djibouti (MCC 638)
  '638-1': { name: 'Djibouti Telecom', bands: ['B3', 'B7', 'B8'] },
  
  // Somalia (MCC 637)
  '637-1': { name: 'Telesom', bands: ['B3', 'B8'] },
  '637-4': { name: 'Somafone', bands: ['B3', 'B8'] },
  '637-10': { name: 'Nationlink', bands: ['B3', 'B8'] },
  '637-30': { name: 'Golis', bands: ['B3', 'B8'] },
  '637-50': { name: 'Hormuud', bands: ['B3', 'B8'] },
  '637-82': { name: 'Telcom', bands: ['B3', 'B8'] },
  
  // Yemen (MCC 421)
  '421-1': { name: 'SabaFon', bands: ['B3', 'B8'] },
  '421-2': { name: 'MTN Yemen', bands: ['B3', 'B8'] },
  '421-3': { name: 'Yemen Mobile', bands: ['B3', 'B8'] },
  
  // Syria (MCC 417)
  '417-1': { name: 'Syriatel', bands: ['B3', 'B8'] },
  '417-2': { name: 'MTN Syria', bands: ['B3', 'B8'] },
  
  // Libya (MCC 606)
  '606-0': { name: 'Libyana', bands: ['B3', 'B8'] },
  '606-1': { name: 'Madar', bands: ['B3', 'B8'] },
  '606-2': { name: 'Al-Jeel', bands: ['B3', 'B8'] },
  
  // Sudan (MCC 634)
  '634-1': { name: 'Zain Sudan', bands: ['B3', 'B8'] },
  '634-2': { name: 'MTN Sudan', bands: ['B3', 'B8'] },
  '634-5': { name: 'Sudani', bands: ['B3', 'B8'] },
  
  // Maritime/Satellite (MCC 901)
  '901-1': { name: 'ICO Global', bands: [] },
  '901-5': { name: 'Thuraya', bands: [] },
  '901-6': { name: 'Thuraya', bands: [] },
  '901-13': { name: 'GSM.AQ (Antarctica)', bands: [] },
  '901-14': { name: 'AeroMobile', bands: [] },
  '901-15': { name: 'OnAir', bands: [] },
  '901-18': { name: 'Cingular Wireless', bands: [] },
  '901-21': { name: 'Seanet Maritime', bands: [] },
  '901-26': { name: 'TIM@sea', bands: [] },
  '901-88': { name: 'UN Telecommunications', bands: [] }
};

// Merge all carriers
const ALL_CARRIERS = { ...US_CARRIERS, ...INTL_CARRIERS };

// Additional MCC mappings for countries - COMPREHENSIVE LIST
const MCC_COUNTRIES = {
  // North America
  '310': 'US', '311': 'US', '312': 'US', '313': 'US', '314': 'US', '315': 'US', '316': 'US',
  '302': 'CA',
  '334': 'MX', '335': 'MX',
  
  // Caribbean
  '338': 'JM', // Jamaica
  '342': 'BB', // Barbados
  '344': 'AG', // Antigua
  '346': 'KY', // Cayman Islands
  '348': 'VG', // British Virgin Islands
  '350': 'BM', // Bermuda
  '352': 'GD', // Grenada
  '354': 'MS', // Montserrat
  '356': 'KN', // St Kitts
  '358': 'LC', // St Lucia
  '360': 'VC', // St Vincent
  '362': 'CW', // Curacao
  '363': 'AW', // Aruba
  '364': 'BS', // Bahamas
  '365': 'AI', // Anguilla
  '366': 'DM', // Dominica
  '368': 'CU', // Cuba
  '370': 'DO', // Dominican Republic
  '372': 'HT', // Haiti
  '374': 'TT', // Trinidad
  '376': 'VI', // US Virgin Islands
  '330': 'PR', // Puerto Rico
  
  // Central America
  '704': 'GT', // Guatemala
  '706': 'SV', // El Salvador
  '708': 'HN', // Honduras
  '710': 'NI', // Nicaragua
  '712': 'CR', // Costa Rica
  '714': 'PA', // Panama
  '716': 'PE', // Peru
  
  // South America
  '722': 'AR', // Argentina
  '724': 'BR', // Brazil
  '730': 'CL', // Chile
  '732': 'CO', // Colombia
  '734': 'VE', // Venezuela
  '736': 'BO', // Bolivia
  '738': 'GY', // Guyana
  '740': 'EC', // Ecuador
  '742': 'GF', // French Guiana
  '744': 'PY', // Paraguay
  '746': 'SR', // Suriname
  '748': 'UY', // Uruguay
  '750': 'FK', // Falkland Islands
  
  // Europe - Western
  '234': 'GB', '235': 'GB', // UK
  '272': 'IE', // Ireland
  '208': 'FR', // France
  '262': 'DE', // Germany
  '204': 'NL', // Netherlands
  '206': 'BE', // Belgium
  '270': 'LU', // Luxembourg
  '228': 'CH', // Switzerland
  '232': 'AT', // Austria
  
  // Europe - Southern
  '222': 'IT', // Italy
  '214': 'ES', // Spain
  '268': 'PT', // Portugal
  '202': 'GR', // Greece
  '278': 'MT', // Malta
  '292': 'SM', // San Marino
  '213': 'AD', // Andorra
  '212': 'MC', // Monaco
  '295': 'LI', // Liechtenstein
  '293': 'SI', // Slovenia
  '219': 'HR', // Croatia
  '218': 'BA', // Bosnia
  '220': 'RS', // Serbia
  '221': 'XK', // Kosovo
  '294': 'MK', // North Macedonia
  '276': 'AL', // Albania
  '297': 'ME', // Montenegro
  
  // Europe - Northern
  '238': 'DK', // Denmark
  '240': 'SE', // Sweden
  '242': 'NO', // Norway
  '244': 'FI', // Finland
  '246': 'LT', // Lithuania
  '247': 'LV', // Latvia
  '248': 'EE', // Estonia
  '274': 'IS', // Iceland
  '266': 'GI', // Gibraltar
  '288': 'FO', // Faroe Islands
  
  // Europe - Eastern
  '260': 'PL', // Poland
  '230': 'CZ', // Czech Republic
  '231': 'SK', // Slovakia
  '216': 'HU', // Hungary
  '226': 'RO', // Romania
  '284': 'BG', // Bulgaria
  '255': 'UA', // Ukraine
  '257': 'BY', // Belarus
  '259': 'MD', // Moldova
  '250': 'RU', // Russia
  
  // Middle East
  '418': 'IQ', // Iraq
  '419': 'KW', // Kuwait
  '420': 'SA', // Saudi Arabia
  '421': 'YE', // Yemen
  '422': 'OM', // Oman
  '424': 'AE', // UAE
  '425': 'IL', // Israel
  '426': 'BH', // Bahrain
  '427': 'QA', // Qatar
  '428': 'MN', // Mongolia
  '429': 'NP', // Nepal
  '430': 'AE', // UAE (alternate)
  '431': 'AE', // UAE (alternate)
  '432': 'IR', // Iran
  '434': 'UZ', // Uzbekistan
  '436': 'TJ', // Tajikistan
  '437': 'KG', // Kyrgyzstan
  '438': 'TM', // Turkmenistan
  '440': 'JP', // Japan
  '441': 'JP', // Japan
  '450': 'KR', // South Korea
  '452': 'VN', // Vietnam
  '454': 'HK', // Hong Kong
  '455': 'MO', // Macau
  '456': 'KH', // Cambodia
  '457': 'LA', // Laos
  '460': 'CN', // China
  '461': 'CN', // China
  '466': 'TW', // Taiwan
  '467': 'KP', // North Korea
  '470': 'BD', // Bangladesh
  '472': 'MV', // Maldives
  '502': 'MY', // Malaysia
  '505': 'AU', // Australia
  '510': 'ID', // Indonesia
  '514': 'TL', // Timor-Leste
  '515': 'PH', // Philippines
  '520': 'TH', // Thailand
  '525': 'SG', // Singapore
  '528': 'BN', // Brunei
  '530': 'NZ', // New Zealand
  '536': 'NR', // Nauru
  '537': 'PG', // Papua New Guinea
  '539': 'TO', // Tonga
  '540': 'SB', // Solomon Islands
  '541': 'VU', // Vanuatu
  '542': 'FJ', // Fiji
  '544': 'AS', // American Samoa
  '545': 'KI', // Kiribati
  '546': 'NC', // New Caledonia
  '547': 'PF', // French Polynesia
  '548': 'CK', // Cook Islands
  '549': 'WS', // Samoa
  '550': 'FM', // Micronesia
  '551': 'MH', // Marshall Islands
  '552': 'PW', // Palau
  '553': 'TV', // Tuvalu
  '555': 'NU', // Niue
  
  // Africa - North
  '602': 'EG', // Egypt
  '603': 'DZ', // Algeria
  '604': 'MA', // Morocco
  '605': 'TN', // Tunisia
  '606': 'LY', // Libya
  '607': 'GM', // Gambia
  '608': 'SN', // Senegal
  '609': 'MR', // Mauritania
  '610': 'ML', // Mali
  '611': 'GN', // Guinea
  '612': 'CI', // Ivory Coast
  '613': 'BF', // Burkina Faso
  '614': 'NE', // Niger
  '615': 'TG', // Togo
  '616': 'BJ', // Benin
  '617': 'MU', // Mauritius
  '618': 'LR', // Liberia
  '619': 'SL', // Sierra Leone
  '620': 'GH', // Ghana
  '621': 'NG', // Nigeria
  '622': 'TD', // Chad
  '623': 'CF', // Central African Republic
  '624': 'CM', // Cameroon
  '625': 'CV', // Cape Verde
  '626': 'ST', // Sao Tome
  '627': 'GQ', // Equatorial Guinea
  '628': 'GA', // Gabon
  '629': 'CG', // Congo
  '630': 'CD', // DR Congo
  '631': 'AO', // Angola
  '632': 'GW', // Guinea-Bissau
  '633': 'SC', // Seychelles
  '634': 'SD', // Sudan
  '635': 'RW', // Rwanda
  '636': 'ET', // Ethiopia
  '637': 'SO', // Somalia
  '638': 'DJ', // Djibouti
  '639': 'KE', // Kenya
  '640': 'TZ', // Tanzania
  '641': 'UG', // Uganda
  '642': 'BI', // Burundi
  '643': 'MZ', // Mozambique
  '645': 'ZM', // Zambia
  '646': 'MG', // Madagascar
  '647': 'RE', // Reunion
  '648': 'ZW', // Zimbabwe
  '649': 'NA', // Namibia
  '650': 'MW', // Malawi
  '651': 'LS', // Lesotho
  '652': 'BW', // Botswana
  '653': 'SZ', // Eswatini
  '654': 'KM', // Comoros
  '655': 'ZA', // South Africa
  '657': 'ER', // Eritrea
  '658': 'SH', // St Helena
  '659': 'SS', // South Sudan
  
  // Caucasus & Central Asia
  '282': 'GE', // Georgia
  '283': 'AM', // Armenia
  '400': 'AZ', // Azerbaijan
  '401': 'KZ', // Kazakhstan
  
  // Turkey & Cyprus
  '286': 'TR', // Turkey
  '280': 'CY', // Cyprus
  
  // Special/Maritime
  '901': 'XX', // International/Maritime
  '999': 'XX'  // Test networks
};

// Country code to flag emoji - COMPREHENSIVE
const COUNTRY_FLAGS = {
  // North America
  'US': '🇺🇸', 'CA': '🇨🇦', 'MX': '🇲🇽',
  
  // Caribbean
  'JM': '🇯🇲', 'BB': '🇧🇧', 'AG': '🇦🇬', 'KY': '🇰🇾', 'VG': '🇻🇬', 'BM': '🇧🇲',
  'GD': '🇬🇩', 'MS': '🇲🇸', 'KN': '🇰🇳', 'LC': '🇱🇨', 'VC': '🇻🇨', 'CW': '🇨🇼',
  'AW': '🇦🇼', 'BS': '🇧🇸', 'AI': '🇦🇮', 'DM': '🇩🇲', 'CU': '🇨🇺', 'DO': '🇩🇴',
  'HT': '🇭🇹', 'TT': '🇹🇹', 'VI': '🇻🇮', 'PR': '🇵🇷',
  
  // Central America
  'GT': '🇬🇹', 'SV': '🇸🇻', 'HN': '🇭🇳', 'NI': '🇳🇮', 'CR': '🇨🇷', 'PA': '🇵🇦', 'PE': '🇵🇪',
  
  // South America
  'AR': '🇦🇷', 'BR': '🇧🇷', 'CL': '🇨🇱', 'CO': '🇨🇴', 'VE': '🇻🇪', 'BO': '🇧🇴',
  'GY': '🇬🇾', 'EC': '🇪🇨', 'GF': '🇬🇫', 'PY': '🇵🇾', 'SR': '🇸🇷', 'UY': '🇺🇾', 'FK': '🇫🇰',
  
  // Europe - Western
  'GB': '🇬🇧', 'IE': '🇮🇪', 'FR': '🇫🇷', 'DE': '🇩🇪', 'NL': '🇳🇱', 'BE': '🇧🇪',
  'LU': '🇱🇺', 'CH': '🇨🇭', 'AT': '🇦🇹',
  
  // Europe - Southern
  'IT': '🇮🇹', 'ES': '🇪🇸', 'PT': '🇵🇹', 'GR': '🇬🇷', 'MT': '🇲🇹', 'SM': '🇸🇲',
  'AD': '🇦🇩', 'MC': '🇲🇨', 'LI': '🇱🇮', 'SI': '🇸🇮', 'HR': '🇭🇷', 'BA': '🇧🇦',
  'RS': '🇷🇸', 'XK': '🇽🇰', 'MK': '🇲🇰', 'AL': '🇦🇱', 'ME': '🇲🇪',
  
  // Europe - Northern
  'DK': '🇩🇰', 'SE': '🇸🇪', 'NO': '🇳🇴', 'FI': '🇫🇮', 'LT': '🇱🇹', 'LV': '🇱🇻',
  'EE': '🇪🇪', 'IS': '🇮🇸', 'GI': '🇬🇮', 'FO': '🇫🇴',
  
  // Europe - Eastern
  'PL': '🇵🇱', 'CZ': '🇨🇿', 'SK': '🇸🇰', 'HU': '🇭🇺', 'RO': '🇷🇴', 'BG': '🇧🇬',
  'UA': '🇺🇦', 'BY': '🇧🇾', 'MD': '🇲🇩', 'RU': '🇷🇺',
  
  // Middle East
  'IQ': '🇮🇶', 'KW': '🇰🇼', 'SA': '🇸🇦', 'YE': '🇾🇪', 'OM': '🇴🇲', 'AE': '🇦🇪',
  'IL': '🇮🇱', 'BH': '🇧🇭', 'QA': '🇶🇦', 'IR': '🇮🇷', 'JO': '🇯🇴', 'SY': '🇸🇾',
  'LB': '🇱🇧', 'PS': '🇵🇸',
  
  // Central Asia
  'MN': '🇲🇳', 'NP': '🇳🇵', 'UZ': '🇺🇿', 'TJ': '🇹🇯', 'KG': '🇰🇬', 'TM': '🇹🇲',
  'KZ': '🇰🇿', 'AF': '🇦🇫', 'PK': '🇵🇰',
  
  // East Asia
  'JP': '🇯🇵', 'KR': '🇰🇷', 'KP': '🇰🇵', 'CN': '🇨🇳', 'TW': '🇹🇼', 'HK': '🇭🇰', 'MO': '🇲🇴',
  
  // Southeast Asia
  'VN': '🇻🇳', 'KH': '🇰🇭', 'LA': '🇱🇦', 'TH': '🇹🇭', 'MM': '🇲🇲', 'MY': '🇲🇾',
  'SG': '🇸🇬', 'ID': '🇮🇩', 'TL': '🇹🇱', 'PH': '🇵🇭', 'BN': '🇧🇳',
  
  // South Asia
  'IN': '🇮🇳', 'BD': '🇧🇩', 'LK': '🇱🇰', 'MV': '🇲🇻', 'BT': '🇧🇹',
  
  // Oceania
  'AU': '🇦🇺', 'NZ': '🇳🇿', 'PG': '🇵🇬', 'FJ': '🇫🇯', 'SB': '🇸🇧', 'VU': '🇻🇺',
  'NC': '🇳🇨', 'PF': '🇵🇫', 'WS': '🇼🇸', 'TO': '🇹🇴', 'KI': '🇰🇮', 'NR': '🇳🇷',
  'FM': '🇫🇲', 'MH': '🇲🇭', 'PW': '🇵🇼', 'TV': '🇹🇻', 'CK': '🇨🇰', 'NU': '🇳🇺',
  'AS': '🇦🇸', 'GU': '🇬🇺',
  
  // Africa - North
  'EG': '🇪🇬', 'DZ': '🇩🇿', 'MA': '🇲🇦', 'TN': '🇹🇳', 'LY': '🇱🇾', 'SD': '🇸🇩', 'SS': '🇸🇸',
  
  // Africa - West
  'NG': '🇳🇬', 'GH': '🇬🇭', 'SN': '🇸🇳', 'CI': '🇨🇮', 'ML': '🇲🇱', 'BF': '🇧🇫',
  'NE': '🇳🇪', 'TG': '🇹🇬', 'BJ': '🇧🇯', 'MR': '🇲🇷', 'GM': '🇬🇲', 'GN': '🇬🇳',
  'SL': '🇸🇱', 'LR': '🇱🇷', 'CV': '🇨🇻', 'GW': '🇬🇼',
  
  // Africa - East
  'KE': '🇰🇪', 'TZ': '🇹🇿', 'UG': '🇺🇬', 'RW': '🇷🇼', 'BI': '🇧🇮', 'ET': '🇪🇹',
  'ER': '🇪🇷', 'DJ': '🇩🇯', 'SO': '🇸🇴', 'MG': '🇲🇬', 'MU': '🇲🇺', 'SC': '🇸🇨',
  'KM': '🇰🇲', 'RE': '🇷🇪',
  
  // Africa - Central
  'CD': '🇨🇩', 'CG': '🇨🇬', 'CF': '🇨🇫', 'CM': '🇨🇲', 'TD': '🇹🇩', 'GA': '🇬🇦',
  'GQ': '🇬🇶', 'ST': '🇸🇹', 'AO': '🇦🇴',
  
  // Africa - Southern
  'ZA': '🇿🇦', 'NA': '🇳🇦', 'BW': '🇧🇼', 'ZW': '🇿🇼', 'ZM': '🇿🇲', 'MW': '🇲🇼',
  'MZ': '🇲🇿', 'LS': '🇱🇸', 'SZ': '🇸🇿', 'SH': '🇸🇭',
  
  // Caucasus
  'GE': '🇬🇪', 'AM': '🇦🇲', 'AZ': '🇦🇿',
  
  // Turkey & Cyprus
  'TR': '🇹🇷', 'CY': '🇨🇾',
  
  // Special
  'XX': '🌐' // International/Maritime
};

function getCountryFlag(mcc) {
  const country = MCC_COUNTRIES[String(mcc)];
  return country ? (COUNTRY_FLAGS[country] || '') : '';
}

function getCountryCode(mcc) {
  return MCC_COUNTRIES[String(mcc)] || null;
}

function getCarrierInfo(mcc, mnc) {
  const key = `${mcc}-${mnc}`;
  const country = getCountryCode(mcc);
  const flag = getCountryFlag(mcc);
  
  if (ALL_CARRIERS[key]) {
    return {
      ...ALL_CARRIERS[key],
      country,
      flag
    };
  }
  // Return generic info with country
  return {
    name: `MCC ${mcc} / MNC ${mnc}`,
    country,
    flag,
    bands: []
  };
}

// Detect expected country based on coordinates
function getExpectedCountry(lat, lon) {
  // Simple bounding box checks for major regions
  // This is approximate - covers major deployment areas
  
  // === NORTH AMERICA ===
  // USA (continental)
  if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) return 'US';
  // Alaska
  if (lat >= 51 && lat <= 72 && lon >= -180 && lon <= -129) return 'US';
  // Hawaii
  if (lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154) return 'US';
  // Puerto Rico
  if (lat >= 17.5 && lat <= 18.6 && lon >= -68 && lon <= -65) return 'PR';
  // Guam
  if (lat >= 13 && lat <= 14 && lon >= 144 && lon <= 145) return 'GU';
  // Canada
  if (lat >= 42 && lat <= 84 && lon >= -141 && lon <= -52) return 'CA';
  // Mexico
  if (lat >= 14 && lat <= 33 && lon >= -118 && lon <= -86) return 'MX';
  
  // === EUROPE ===
  // UK
  if (lat >= 49 && lat <= 61 && lon >= -11 && lon <= 2) return 'GB';
  // Ireland
  if (lat >= 51 && lat <= 56 && lon >= -11 && lon <= -5) return 'IE';
  // Germany
  if (lat >= 47 && lat <= 55 && lon >= 5 && lon <= 15) return 'DE';
  // France
  if (lat >= 41 && lat <= 51 && lon >= -5 && lon <= 10) return 'FR';
  // Spain
  if (lat >= 36 && lat <= 44 && lon >= -10 && lon <= 4) return 'ES';
  // Italy
  if (lat >= 36 && lat <= 47 && lon >= 6 && lon <= 19) return 'IT';
  // Poland
  if (lat >= 49 && lat <= 55 && lon >= 14 && lon <= 24) return 'PL';
  // Norway
  if (lat >= 58 && lat <= 72 && lon >= 4 && lon <= 31) return 'NO';
  // Sweden
  if (lat >= 55 && lat <= 70 && lon >= 10 && lon <= 25) return 'SE';
  // Finland
  if (lat >= 59 && lat <= 70 && lon >= 20 && lon <= 32) return 'FI';
  // Denmark
  if (lat >= 54 && lat <= 58 && lon >= 7 && lon <= 16) return 'DK';
  // Netherlands
  if (lat >= 50.5 && lat <= 54 && lon >= 3 && lon <= 7.5) return 'NL';
  // Belgium
  if (lat >= 49.5 && lat <= 51.5 && lon >= 2.5 && lon <= 6.5) return 'BE';
  // Switzerland
  if (lat >= 45.5 && lat <= 48 && lon >= 5.5 && lon <= 10.5) return 'CH';
  // Austria
  if (lat >= 46 && lat <= 49 && lon >= 9 && lon <= 17) return 'AT';
  // Greece
  if (lat >= 34 && lat <= 42 && lon >= 19 && lon <= 30) return 'GR';
  // Turkey
  if (lat >= 36 && lat <= 42 && lon >= 26 && lon <= 45) return 'TR';
  // Romania
  if (lat >= 43 && lat <= 48 && lon >= 20 && lon <= 30) return 'RO';
  // Ukraine
  if (lat >= 44 && lat <= 53 && lon >= 22 && lon <= 40) return 'UA';
  
  // === MIDDLE EAST ===
  // Iraq
  if (lat >= 29 && lat <= 38 && lon >= 38 && lon <= 49) return 'IQ';
  // Kuwait
  if (lat >= 28.5 && lat <= 30.5 && lon >= 46 && lon <= 49) return 'KW';
  // Saudi Arabia
  if (lat >= 16 && lat <= 33 && lon >= 34 && lon <= 56) return 'SA';
  // UAE
  if (lat >= 22 && lat <= 26 && lon >= 51 && lon <= 57) return 'AE';
  // Qatar
  if (lat >= 24.5 && lat <= 26.5 && lon >= 50 && lon <= 52) return 'QA';
  // Bahrain
  if (lat >= 25.5 && lat <= 26.5 && lon >= 50 && lon <= 51) return 'BH';
  // Oman
  if (lat >= 16 && lat <= 27 && lon >= 52 && lon <= 60) return 'OM';
  // Yemen
  if (lat >= 12 && lat <= 19 && lon >= 42 && lon <= 55) return 'YE';
  // Jordan
  if (lat >= 29 && lat <= 33 && lon >= 34 && lon <= 39) return 'JO';
  // Israel
  if (lat >= 29 && lat <= 33.5 && lon >= 34 && lon <= 36) return 'IL';
  // Syria
  if (lat >= 32 && lat <= 37.5 && lon >= 35 && lon <= 42.5) return 'SY';
  // Iran
  if (lat >= 25 && lat <= 40 && lon >= 44 && lon <= 64) return 'IR';
  // Afghanistan
  if (lat >= 29 && lat <= 39 && lon >= 60 && lon <= 75) return 'AF';
  
  // === ASIA ===
  // Russia (European part)
  if (lat >= 41 && lat <= 82 && lon >= 19 && lon <= 180) return 'RU';
  // Japan
  if (lat >= 24 && lat <= 46 && lon >= 123 && lon <= 146) return 'JP';
  // South Korea
  if (lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132) return 'KR';
  // North Korea
  if (lat >= 37.5 && lat <= 43 && lon >= 124 && lon <= 131) return 'KP';
  // China
  if (lat >= 18 && lat <= 54 && lon >= 73 && lon <= 135) return 'CN';
  // Taiwan
  if (lat >= 21.5 && lat <= 26 && lon >= 119 && lon <= 122.5) return 'TW';
  // Philippines
  if (lat >= 4 && lat <= 21 && lon >= 116 && lon <= 127) return 'PH';
  // Vietnam
  if (lat >= 8 && lat <= 24 && lon >= 102 && lon <= 110) return 'VN';
  // Thailand
  if (lat >= 5 && lat <= 21 && lon >= 97 && lon <= 106) return 'TH';
  // Singapore
  if (lat >= 1 && lat <= 1.5 && lon >= 103 && lon <= 104.5) return 'SG';
  // Malaysia
  if (lat >= 0.5 && lat <= 8 && lon >= 99 && lon <= 120) return 'MY';
  // Indonesia
  if (lat >= -11 && lat <= 6 && lon >= 94 && lon <= 141) return 'ID';
  // India
  if (lat >= 6 && lat <= 36 && lon >= 68 && lon <= 98) return 'IN';
  // Pakistan
  if (lat >= 23 && lat <= 37 && lon >= 60 && lon <= 77) return 'PK';
  
  // === OCEANIA ===
  // Australia
  if (lat >= -44 && lat <= -10 && lon >= 113 && lon <= 154) return 'AU';
  // New Zealand
  if (lat >= -48 && lat <= -33 && lon >= 165 && lon <= 179) return 'NZ';
  
  // === AFRICA ===
  // Egypt
  if (lat >= 22 && lat <= 32 && lon >= 24 && lon <= 37) return 'EG';
  // Libya
  if (lat >= 19 && lat <= 34 && lon >= 9 && lon <= 25) return 'LY';
  // Sudan
  if (lat >= 8 && lat <= 23 && lon >= 21 && lon <= 39) return 'SD';
  // Somalia
  if (lat >= -2 && lat <= 12 && lon >= 40 && lon <= 52) return 'SO';
  // Djibouti
  if (lat >= 10.5 && lat <= 13 && lon >= 41 && lon <= 44) return 'DJ';
  // Kenya
  if (lat >= -5 && lat <= 5 && lon >= 33 && lon <= 42) return 'KE';
  // South Africa
  if (lat >= -35 && lat <= -22 && lon >= 16 && lon <= 33) return 'ZA';
  // Nigeria
  if (lat >= 4 && lat <= 14 && lon >= 2 && lon <= 15) return 'NG';
  
  // === CARIBBEAN ===
  // Cuba
  if (lat >= 19.5 && lat <= 23.5 && lon >= -85 && lon <= -74) return 'CU';
  // Jamaica
  if (lat >= 17 && lat <= 19 && lon >= -79 && lon <= -76) return 'JM';
  // Haiti
  if (lat >= 18 && lat <= 20 && lon >= -75 && lon <= -71) return 'HT';
  // Dominican Republic
  if (lat >= 17 && lat <= 20 && lon >= -72 && lon <= -68) return 'DO';
  
  // === SOUTH AMERICA ===
  // Brazil
  if (lat >= -34 && lat <= 6 && lon >= -74 && lon <= -34) return 'BR';
  // Colombia
  if (lat >= -5 && lat <= 14 && lon >= -82 && lon <= -66) return 'CO';
  // Peru
  if (lat >= -19 && lat <= 0 && lon >= -82 && lon <= -68) return 'PE';
  // Argentina
  if (lat >= -56 && lat <= -21 && lon >= -74 && lon <= -53) return 'AR';
  // Chile
  if (lat >= -56 && lat <= -17 && lon >= -76 && lon <= -66) return 'CL';
  
  return null;
}

function getCarrierInfo(mcc, mnc) {
  const key = `${mcc}-${mnc}`;
  const flag = getCountryFlag(mcc);
  const country = MCC_COUNTRIES[String(mcc)] || 'Unknown';
  
  if (ALL_CARRIERS[key]) {
    return {
      ...ALL_CARRIERS[key],
      flag,
      country
    };
  }
  // Return generic info with country
  return {
    name: `MCC ${mcc} / MNC ${mnc}`,
    country,
    flag,
    bands: []
  };
}

function getCacheKey(lat, lon, range) {
  // Round to ~100m precision for cache grouping
  const latRound = Math.round(lat * 1000) / 1000;
  const lonRound = Math.round(lon * 1000) / 1000;
  return `${latRound}_${lonRound}_${range}`;
}

async function fetchFromOpenCelliD(lat, lon, range) {
  return new Promise((resolve, reject) => {
    // OpenCelliD limits BBOX to 4,000,000 sq meters (4 km²)
    // Max safe box is about 2km x 2km, so cap range at 1000m (creates 2km x 2km box)
    const maxRange = 1000; // 1km radius = 2km x 2km box = 4 km²
    const effectiveRange = Math.min(range, maxRange);
    
    // Create bounding box from center point and range (in meters)
    const rangeKm = effectiveRange / 1000;
    const latDelta = rangeKm / 111; // ~111km per degree latitude
    const lonDelta = rangeKm / (111 * Math.cos(lat * Math.PI / 180));
    
    const bbox = `${lat - latDelta},${lon - lonDelta},${lat + latDelta},${lon + lonDelta}`;
    
    const apiUrl = `https://opencellid.org/cell/getInArea?key=${OPENCELLID_TOKEN}&BBOX=${bbox}&format=json&limit=50`;
    
    console.log(`[Cell] Fetching: ${apiUrl.replace(OPENCELLID_TOKEN, 'TOKEN')}`);
    console.log(`[Cell] Range requested: ${range}m, effective: ${effectiveRange}m`);
    
    https.get(apiUrl, {
      headers: {
        'User-Agent': 'RussellTV/1.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`[Cell] API error: ${res.statusCode} - ${data}`);
            reject(new Error(`API returned ${res.statusCode}`));
            return;
          }
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          console.error(`[Cell] Parse error: ${e.message}`);
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function processResults(data, centerLat, centerLon) {
  if (!data || !data.cells || !Array.isArray(data.cells)) {
    return {
      towers: [],
      carriers: {},
      technologies: {},
      summary: { total: 0, coverage: 'unknown' }
    };
  }
  
  const carriers = {};
  const technologies = { '5G': 0, 'LTE': 0, 'UMTS': 0, 'GSM': 0, 'CDMA': 0 };
  const countriesDetected = new Set();
  const signals = [];
  
  // Get expected country based on coordinates
  const expectedCountry = getExpectedCountry(centerLat, centerLon);
  
  // Calculate distance for each tower
  const towers = data.cells.map(cell => {
    const distance = haversineDistance(centerLat, centerLon, cell.lat, cell.lon);
    const carrierKey = `${cell.mcc}-${cell.mnc}`;
    const carrierInfo = getCarrierInfo(cell.mcc, cell.mnc);
    const cellCountry = getCountryCode(cell.mcc);
    
    if (cellCountry) countriesDetected.add(cellCountry);
    
    // Track signal strength if available
    if (cell.averageSignalStrength && cell.averageSignalStrength !== 0) {
      signals.push(cell.averageSignalStrength);
    }
    
    // Count carriers
    if (!carriers[carrierKey]) {
      carriers[carrierKey] = {
        ...carrierInfo,
        mcc: cell.mcc,
        mnc: cell.mnc,
        count: 0,
        technologies: {}
      };
    }
    carriers[carrierKey].count++;
    
    // Map radio type to technology
    let tech = cell.radio || 'Unknown';
    if (tech === 'NR' || tech === 'NBIOT') tech = '5G';
    else if (tech === 'LTE' || tech === 'LTECATM') tech = 'LTE';
    else if (['UMTS', 'HSPA', 'HSPA+', 'HSDPA', 'HSUPA', 'TDSCDMA'].includes(tech)) tech = 'UMTS';
    else if (['GSM', 'GPRS', 'EDGE'].includes(tech)) tech = 'GSM';
    else if (['CDMA', '1xRTT', 'EVDO_0', 'EVDO_A', 'EVDO_B', 'eHRPD', 'IS95A', 'IS95B'].includes(tech)) tech = 'CDMA';
    
    if (technologies[tech] !== undefined) technologies[tech]++;
    if (!carriers[carrierKey].technologies[tech]) carriers[carrierKey].technologies[tech] = 0;
    carriers[carrierKey].technologies[tech]++;
    
    return {
      lat: cell.lat,
      lon: cell.lon,
      distance: Math.round(distance),
      mcc: cell.mcc,
      mnc: cell.mnc,
      carrier: carrierInfo.name,
      flag: carrierInfo.flag || '',
      country: carrierInfo.country,
      radio: cell.radio,
      technology: tech,
      lac: cell.lac || cell.tac,
      cellid: cell.cellid,
      signal: cell.averageSignalStrength,
      range: cell.range,
      samples: cell.samples
    };
  }).sort((a, b) => a.distance - b.distance);
  
  // Determine coverage quality
  let coverage = 'none';
  const total = towers.length;
  if (total > 0) {
    const nearby = towers.filter(t => t.distance < 1000).length;
    if (nearby >= 5 || total >= 15) coverage = 'excellent';
    else if (nearby >= 2 || total >= 8) coverage = 'good';
    else if (nearby >= 1 || total >= 3) coverage = 'moderate';
    else coverage = 'limited';
  }
  
  // Check for roaming (towers from different country than expected)
  const roamingCountries = [];
  if (expectedCountry) {
    for (const country of countriesDetected) {
      if (country !== expectedCountry) {
        roamingCountries.push({
          country,
          flag: COUNTRY_FLAGS[country] || ''
        });
      }
    }
  }
  
  // Calculate signal strength statistics
  let signalStats = null;
  if (signals.length > 0) {
    const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
    const min = Math.min(...signals);
    const max = Math.max(...signals);
    signalStats = {
      avg: Math.round(avg),
      min,
      max,
      samples: signals.length,
      quality: avg >= -70 ? 'excellent' : avg >= -85 ? 'good' : avg >= -100 ? 'fair' : 'poor'
    };
  }
  
  return {
    towers: towers.slice(0, 20), // Return top 20 closest
    carriers: Object.values(carriers).sort((a, b) => b.count - a.count),
    technologies,
    summary: {
      total,
      coverage,
      nearestTower: towers[0] ? towers[0].distance : null,
      has5G: technologies['5G'] > 0,
      hasLTE: technologies['LTE'] > 0,
      expectedCountry,
      expectedCountryFlag: expectedCountry ? COUNTRY_FLAGS[expectedCountry] : null,
      roamingWarning: roamingCountries.length > 0,
      roamingCountries,
      signalStats
    }
  };
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  
  // Health check
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'cell-proxy' }));
    return;
  }
  
  // Main endpoint: /cell?lat=X&lon=Y&range=5000
  if (parsedUrl.pathname === '/cell' || parsedUrl.pathname === '/cell/nearby') {
    const { lat, lon, range = '5000' } = parsedUrl.query;
    
    if (!lat || !lon) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing lat or lon parameter' }));
      return;
    }
    
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const rangeNum = parseInt(range, 10);
    
    if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid coordinates' }));
      return;
    }
    
    try {
      // Check cache
      const cacheKey = getCacheKey(latNum, lonNum, rangeNum);
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        console.log(`[Cell] Cache hit for ${cacheKey}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cached.data));
        return;
      }
      
      // Fetch from API
      const rawData = await fetchFromOpenCelliD(latNum, lonNum, rangeNum);
      const processed = processResults(rawData, latNum, lonNum);
      
      // Cache result
      cache.set(cacheKey, { data: processed, time: Date.now() });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(processed));
      
    } catch (error) {
      console.error(`[Cell] Error: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Failed to fetch cell data',
        message: error.message,
        // Return empty but valid structure
        towers: [],
        carriers: [],
        technologies: {},
        summary: { total: 0, coverage: 'unknown' }
      }));
    }
    return;
  }
  
  // Carrier info endpoint
  if (parsedUrl.pathname === '/cell/carriers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      us_carriers: US_CARRIERS,
      mcc_countries: MCC_COUNTRIES
    }));
    return;
  }
  
  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[Cell] Proxy server running on port ${PORT}`);
  console.log(`[Cell] Endpoints:`);
  console.log(`       GET /cell?lat=X&lon=Y&range=5000`);
  console.log(`       GET /cell/carriers`);
  console.log(`       GET /health`);
});
