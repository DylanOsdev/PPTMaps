import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { FaSkull, FaHospital, FaCar, FaCloudRain, FaExclamationTriangle, FaChartBar } from 'react-icons/fa';

const iconCache = {};

function getIconSvg(iconComp, size = 16) {
  const key = `${iconComp.name}-${size}`;
  if (iconCache[key]) return iconCache[key];
  const svg = renderToStaticMarkup(
    createElement(iconComp, { size, style: { verticalAlign: 'middle', display: 'block' } })
  );
  iconCache[key] = svg;
  return svg;
}

export function getAccidentSvg(severity) {
  switch (severity) {
    case 'high':
      return getIconSvg(FaSkull, 16);
    case 'medium':
      return getIconSvg(FaHospital, 16);
    case 'low':
    default:
      return getIconSvg(FaCar, 16);
  }
}

export function getAlertIconSvg(type) {
  switch (type) {
    case 'siata':
      return getIconSvg(FaCloudRain, 14);
    case 'report':
    case 'citizen':
      return getIconSvg(FaExclamationTriangle, 14);
    case 'traffic':
    default:
      return getIconSvg(FaChartBar, 14);
  }
}
