(function () {
    const SUPPORTED_LANGUAGES = ['ko', 'en', 'zh', 'ja', 'ru', 'vi'];
    let currentLang = 'ko';
    let translations = {};
    let koSourceDict = {};
    let koToKeyMap = new Map();

    // Helper to resolve nested keys
    function resolveKeyPath(obj, path) {
        if (!obj || !path) return undefined;
        const direct = path.split('.').reduce((acc, part) => acc && acc[part], obj);
        if (direct !== undefined) return direct;
        if (obj.audio && obj.audio[path] !== undefined) return obj.audio[path];
        if (obj.nav && obj.nav[path] !== undefined) return obj.nav[path];
        return undefined;
    }


    // Helper to flatten nested JSON objects into a Map (Value -> Key path)
    function flattenTranslations(obj, prefix = '') {
        Object.entries(obj).forEach(([key, val]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            if (val && typeof val === 'object') {
                flattenTranslations(val, path);
            } else if (typeof val === 'string') {
                const trimmedKo = val.trim();
                if (trimmedKo) {
                    koToKeyMap.set(trimmedKo, path);
                }
            }
        });
    }

    // Initialize Language
    async function initLanguage() {
        let lang = localStorage.getItem('preferred_lang') || localStorage.getItem('kadio-lang');
        if (!lang) {
            const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase().slice(0, 2);
            lang = SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : 'en';
        }
        currentLang = lang;
        localStorage.setItem('preferred_lang', currentLang);
        localStorage.setItem('kadio-lang', currentLang);


        try {
            // Load KO dictionary first as translation source mapping (using relative path for GitHub Pages compatibility)
            const koRes = await fetch('./locales/ko.json');
            koSourceDict = await koRes.json();
            flattenTranslations(koSourceDict);

            // Load target language translations
            const res = await fetch(`./locales/${currentLang}.json`);
            if (!res.ok) throw new Error(`Failed to load ${currentLang} locale`);
            translations = await res.json();
        } catch (err) {
            console.error('[i18n] Error loading translation files:', err);
            if (currentLang !== 'ko') {
                currentLang = 'ko';
                translations = koSourceDict;
            }
        }

        // Translate the static DOM nodes
        translatePage();

        // Listen for dynamically added elements using MutationObserver
        setupMutationObserver();

        // Set up selectors
        setupLanguageSelectors();
    }

    // Dynamic node translation helper
    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const originalText = node.nodeValue.trim();
            if (originalText) {
                const key = koToKeyMap.get(originalText);
                if (key) {
                    const translatedVal = resolveKeyPath(translations, key);
                    if (translatedVal) {
                        node.nodeValue = node.nodeValue.replace(originalText, translatedVal);
                    }
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.getAttribute('translate') === 'no' || node.classList.contains('i18n-exclude')) {
                return;
            }

            // Translate data-i18n elements explicitly if defined
            const explicitKey = node.getAttribute('data-i18n');
            if (explicitKey) {
                const translatedVal = resolveKeyPath(translations, explicitKey) || resolveKeyPath(koSourceDict, explicitKey);
                if (translatedVal) {
                    const hasChildren = node.children.length > 0;
                    if (hasChildren) {
                        let replaced = false;
                        node.childNodes.forEach(child => {
                            if (child.nodeType === Node.TEXT_NODE) {
                                child.nodeValue = translatedVal;
                                replaced = true;
                            }
                        });
                        if (!replaced) node.appendChild(document.createTextNode(translatedVal));
                    } else {
                        node.textContent = translatedVal;
                    }
                }
            }

            // Translate data-i18n-placeholder or placeholder
            const explicitPlaceholderKey = node.getAttribute('data-i18n-placeholder');
            if (explicitPlaceholderKey) {
                const translatedVal = resolveKeyPath(translations, explicitPlaceholderKey) || resolveKeyPath(koSourceDict, explicitPlaceholderKey);
                if (translatedVal) {
                    node.placeholder = translatedVal;
                }
            } else if (node.placeholder) {
                const origPlaceholder = node.placeholder.trim();
                const key = koToKeyMap.get(origPlaceholder);
                if (key) {
                    const translatedVal = resolveKeyPath(translations, key);
                    if (translatedVal) {
                        node.placeholder = translatedVal;
                    }
                }
            }

            // Translate list/datalist option labels if needed
            if (node.tagName === 'OPTION' && node.text && !explicitKey) {
                const origText = node.text.trim();
                const key = koToKeyMap.get(origText);
                if (key) {
                    const translatedVal = resolveKeyPath(translations, key);
                    if (translatedVal) {
                        node.text = translatedVal;
                    }
                }
            }

            // Recurse children
            node.childNodes.forEach(translateNode);
        }
    }


    // Scan and translate the entire body
    function translatePage() {
        translateNode(document.body);

        // Translate document title
        const pageType = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
        const titleKey = `title.${pageType}`;
        const translatedTitle = resolveKeyPath(translations, titleKey);
        if (translatedTitle) {
            document.title = translatedTitle;
        }
    }

    // Dynamic mutation observer to capture newly added nodes (like templates, log rows, comparisons)
    function setupMutationObserver() {
        const observer = new MutationObserver(mutations => {

            mutations.forEach(mutation => {
                if (mutation.type === 'characterData') {
                    // Prevent infinite loops by temporarily disconnecting the observer
                    observer.disconnect();
                    translateNode(mutation.target);
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        characterData: true
                    });
                } else if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(node => {
                        translateNode(node);
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // Dynamic string translation utility
    function t(key, params = {}) {
        if (!key) return '';
        let lookupKey = key;
        const trimmed = String(key).trim();
        if (koToKeyMap.has(trimmed)) {
            lookupKey = koToKeyMap.get(trimmed);
        }
        let text = resolveKeyPath(translations, lookupKey) || resolveKeyPath(koSourceDict, lookupKey) || key;
        Object.entries(params).forEach(([k, v]) => {
            text = text.replace(new RegExp(`{${k}}`, 'g'), v);
        });
        return text;
    }

    // Drop-down & button event listener binding
    function setupLanguageSelectors() {
        const selects = document.querySelectorAll('.lang-select');
        selects.forEach(select => {
            select.value = currentLang;
            select.removeEventListener('change', onLanguageChange);
            select.addEventListener('change', onLanguageChange);
        });

        const langBtn = document.getElementById('langToggle');
        if (langBtn) {
            langBtn.textContent = currentLang.toUpperCase();
            langBtn.onclick = () => {
                const idx = SUPPORTED_LANGUAGES.indexOf(currentLang);
                const nextLang = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length];
                setLanguage(nextLang);
            };
        }
    }


    function onLanguageChange(e) {
        const newLang = e.target.value;
        if (SUPPORTED_LANGUAGES.includes(newLang)) {
            localStorage.setItem('preferred_lang', newLang);
            localStorage.setItem('kadio-lang', newLang);
            window.location.reload();
        }
    }

    // Translate an API error code to a user-facing message
    function translateError(code) {
        if (!code) return '';
        return resolveKeyPath(translations, `errors.${code}`) || resolveKeyPath(koSourceDict, `errors.${code}`) || code;
    }

    // Translate a tier key to a user-facing name
    function translateTier(tierKey) {
        if (!tierKey) return '';
        return resolveKeyPath(translations, `tiers.${tierKey}`) || resolveKeyPath(koSourceDict, `tiers.${tierKey}`) || tierKey;
    }

    // Translate an API response message (checks code field first, falls back to message)
    function translateResponse(response) {
        if (response && response.code) {
            // Check errors first, then messages
            return translateError(response.code) || resolveKeyPath(translations, `messages.${response.code}`) || resolveKeyPath(koSourceDict, `messages.${response.code}`) || response.code;
        }
        return response?.message || '';
    }

    function setLanguage(lang) {
        if (SUPPORTED_LANGUAGES.includes(lang)) {
            localStorage.setItem('preferred_lang', lang);
            localStorage.setItem('kadio-lang', lang);
            window.location.reload();
        }
    }


    // Export i18n functions
    window.i18n = {
        init: initLanguage,
        t: t,
        translate: translatePage,
        getLang: () => currentLang,
        setLanguage: setLanguage,
        translateError: translateError,
        translateTier: translateTier,
        translateResponse: translateResponse
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLanguage);
    } else {
        initLanguage();
    }
})();
