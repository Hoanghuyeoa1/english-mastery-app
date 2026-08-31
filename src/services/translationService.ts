/**
 * Dịch văn bản Anh <-> Việt sử dụng Google Translate client API và MyMemory API làm dự phòng
 */
export async function translateText(
  text: string,
  sourceLang: 'en' | 'vi' = 'en',
  targetLang: 'en' | 'vi' = 'vi'
): Promise<string> {
  if (!text.trim()) return '';

  // 1. Thử Google Translate Public Client Endpoint
  try {
    const encoded = encodeURIComponent(text.trim());
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translatedParts = data[0].map((item: any) => item[0]).filter(Boolean);
        if (translatedParts.length > 0) {
          return translatedParts.join('');
        }
      }
    }
  } catch (err) {
    console.warn('Google Translate API failed, trying MyMemory fallback...', err);
  }

  // 2. Dự phòng: MyMemory Translation API
  try {
    const langPair = `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${langPair}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    }
  } catch (err) {
    console.error('All translation APIs failed:', err);
  }

  return '';
}
