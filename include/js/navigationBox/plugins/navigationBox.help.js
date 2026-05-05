/* ensure namespace exists */
var midwinter = midwinter || {};
midwinter.navigationBox = midwinter.navigationBox || {};

midwinter.navigationBox.help = {
    _cssLoaded: false,
    _cacheTTL: 604800, // cache duration in seconds (7 days)

    getDefaultConfig: function(overrides = {}) {
        return $.extend(true, {
            title: 'Cacti Help',
            helper: 'help',
            buttons: { search: 'highlightText' },
            contentLoader: 'midwinter.navigationBox.help.content',
            initCallback: 'midwinter.navigationBox.help.init',
            isRefreshable: true,
        }, overrides);
    },

    content: function() {
        return `<div class="mdw-help-wrapper">
                    <div class="mdw-help-content" id="mdw-help-remote">
                        <div class="mdw-loader-text"><i class="fa fa-spinner fa-spin"></i> Loading documentation...</div>
                    </div>
                </div>`;
    },

    init: function($box) {
        this._injectStyles();
        this.loadCactiHelp($box);
    },

    /**
     * Uses Cacti's help logic and data attributes to fetch documentation.
     */
    loadCactiHelp: async function($box) {
        const $container = $box.find('#mdw-help-remote');

        /* 1. Identify help page context from Cacti's data-page attribute */
        let helpPage = $('.helpPage').first().data('page');

        if (!helpPage) {
            helpPage = window.location.pathname.split("/").pop().replace('.php', '') || 'index';
        }

        /* 2. Check local storage cache */
        const cacheKey = 'mdw_help_cache_' + helpPage;
        const cachedData = this._getCache(cacheKey);

        if (cachedData) {
            await this._displayAndFixImages($container, cachedData.html, cachedData.baseUrl);
            return;
        }

        try {
            /* 3. Query Cacti native help endpoint */
            const helpEndpoint = (typeof urlPath !== 'undefined' ? urlPath : '/') + 'help.php?page=' + encodeURIComponent(helpPage);
            const response = await fetch(helpEndpoint);
            const data = await response.json();

            if (data.status !== 'Success' || !data.location) {
                throw new Error(data.message || 'Help location not found');
            }

            /* 4. Fetch the actual content from the location returned by Cacti */
            const contentResponse = await fetch(data.location);
            if (!contentResponse.ok) throw new Error('Could not fetch content from source');

            const fullHtml = await contentResponse.text();
            const baseUrl = data.location.substring(0, data.location.lastIndexOf('/') + 1);

            /* 5. Extract <body> and Sanitize HTML for XSS prevention */
            const sanitizedContent = this._sanitizeAndExtractBody(fullHtml);

            /* 6. Store in cache and render */
            this._setCache(cacheKey, { html: sanitizedContent, baseUrl: baseUrl });
            await this._displayAndFixImages($container, sanitizedContent, baseUrl);

        } catch (e) {
            $container.html(`
                <div class="mdw-help-error">
                    <p>Documentation could not be loaded.</p>
                    <small>${e.message}</small>
                </div>
            `);
        }
    },

    /**
     * Extracts only the content from the <body> tag and sanitizes it
     */
    _sanitizeAndExtractBody: function(html) {
        const parser = new DOMParser();
        // DOMParser.parseFromString always creates a full document with <html>, <head>, <body>
        const doc = parser.parseFromString(html, 'text/html');

        const blacklist = ['script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link', 'style'];
        blacklist.forEach(tag => {
            const elements = doc.querySelectorAll(tag);
            elements.forEach(el => el.remove());
        });

        const allElements = doc.querySelectorAll('*');
        allElements.forEach(el => {
            const attrs = el.attributes;
            for (let j = attrs.length - 1; j >= 0; j--) {
                if (attrs[j].name.startsWith('on')) {
                    el.removeAttribute(attrs[j].name);
                }
            }
        });

        // Return only the innerHTML of the body to strip <html>, <head> and <body> tags
        return doc.body.innerHTML;
    },

    /**
     * Renders content and fixes asset paths
     */
    _displayAndFixImages: async function($container, html, baseUrl) {
        $container.html(`<div class="mdw-help-rendered github-preview">${html}</div>`);

        const images = $container.find('img');
        for (let img of images) {
            const $img = $(img);
            let src = $img.attr('src');

            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                src = baseUrl + src;

                if (src.startsWith('http')) {
                    try {
                        const res = await fetch(src);
                        const blob = await res.blob();
                        $img.attr('src', URL.createObjectURL(blob));
                    } catch (e) {
                        console.error("Image load error:", src);
                    }
                } else {
                    $img.attr('src', src);
                }
            }
        }

        $container.find('a').each(function() {
            const $a = $(this);
            let href = $a.attr('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                $a.attr('href', baseUrl + href).attr('target', '_blank');
            }
        });
    },

    _setCache: function(key, dataObj) {
        const cacheObj = {
            timestamp: new Date().getTime(),
            data: dataObj
        };
        localStorage.setItem(key, JSON.stringify(cacheObj));
    },

    _getCache: function(key) {
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const cacheObj = JSON.parse(cached);
        const now = new Date().getTime();

        if (now - cacheObj.timestamp > this._cacheTTL * 1000) {
            localStorage.removeItem(key);
            return null;
        }
        return cacheObj.data;
    },

    _injectStyles: function() {
        if (this._cssLoaded) return;
        const themePath = (typeof urlPath !== 'undefined' ? urlPath : '/') + 'include/themes/midwinter/';
        $('head').append(`<link rel="stylesheet" href="${themePath}css/plugins/navigationBox.help.css">`);
        this._cssLoaded = true;
    }
};

midwinter.navigationBox.registerPlugin('midwinter.navigationBox.help');
