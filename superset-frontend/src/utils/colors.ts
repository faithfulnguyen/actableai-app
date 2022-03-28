export function hslToHex(hue: number, saturation: number, light: number) {
  const lightPercent = light / 100;
  const a = (saturation * Math.min(lightPercent, 1 - lightPercent)) / 100;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const color = lightPercent - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0'); // convert to Hex and prefix "0" if needed
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}