import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import hi from './hi.json';
import bn from './bn.json';
import ta from './ta.json';
import te from './te.json';
import mr from './mr.json';
import gu from './gu.json';
import kn from './kn.json';
import ml from './ml.json';
import pa from './pa.json';
import ur from './ur.json';
import or_ from './or.json';
import as_ from './as.json';

export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ' },
  { code: 'as', label: 'Assamese', nativeLabel: 'অসমীয়া' },
];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    bn: { translation: bn },
    ta: { translation: ta },
    te: { translation: te },
    mr: { translation: mr },
    gu: { translation: gu },
    kn: { translation: kn },
    ml: { translation: ml },
    pa: { translation: pa },
    ur: { translation: ur },
    or: { translation: or_ },
    as: { translation: as_ },
  },
  lng: localStorage.getItem('loksetu-lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
