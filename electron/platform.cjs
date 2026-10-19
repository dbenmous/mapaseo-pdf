// Keep filesystem comparisons conservative on case-sensitive macOS volumes.
function pathKey(value, platform = process.platform) {
  return platform === 'win32' ? value.toLowerCase() : value;
}

function windowChrome(platform = process.platform) {
  return platform === 'darwin'
    ? { frame: true, titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 13 } }
    : { frame: false };
}

module.exports = { pathKey, windowChrome };
