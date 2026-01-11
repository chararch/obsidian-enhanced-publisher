const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for Blob and File if needed, though jsdom usually handles them, 
// sometimes older versions or specific configurations miss them.
// But valid for this specific error, TextEncoder is the culprit.
