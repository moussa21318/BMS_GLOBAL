import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './ar.json'
import fr from './fr.json'
import en from './en.json'

const savedLang = localStorage.getItem('app_lang') || 'ar'

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, fr: { translation: fr }, en: { translation: en } },
  lng: savedLang,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
})

export default i18n

export const changeLang = (lang: 'ar' | 'fr' | 'en') => {
  i18n.changeLanguage(lang)
  localStorage.setItem('app_lang', lang)
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}
