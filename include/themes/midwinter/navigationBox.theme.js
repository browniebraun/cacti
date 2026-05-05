// ensure namespace exists
var midwinter = midwinter || {};
midwinter.navigationBox = midwinter.navigationBox || {};

midwinter.navigationBox.theme = {
    getDefaultConfig: function(overrides = {}) {
        const base = 'midwinter.navigationBox.theme';
        const defaults = {
            title: 'Theme Settings',
            helper: 'theme',
            contentLoader: `${base}.content`,
            initCallback: `${base}.init`
        };
        return $.extend(true, {}, defaults, overrides);
    },

    _actions: {
        toggleColor: function() {
            // skip if auto mode is enabled
            if (mdw.session.theme.color.auto === 'on') return;

            const current = mdw.session.theme.color.mode;
            const next = (current === 'dark') ? 'light' : 'dark';

            mdw.session.theme.color.mode = next;
            setDocumentAttribute('theme-color', next);

            if (typeof setCookieValue === 'function') setCookieValue('CactiColorMode', next);
            if (typeof refreshLocalStorage === 'function') refreshLocalStorage();
            if (typeof initializeGraphs === 'function') initializeGraphs(true);

            midwinter.navigationBox.theme._syncIcons(next);
        },

        toggleSetting: function(e, sessionPath, attrName) {
            const state = e.target.checked ? 'on' : 'off';
            const display = document.getElementById(e.target.id + 'Value');

            // update session value
            const parts = sessionPath.split('.');
            let obj = mdw.session.theme;
            for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
            obj[parts[parts.length - 1]] = state;

            if (display) display.textContent = state;
            setDocumentAttribute(attrName, state);

            // handle auto-mode dependencies
            if (attrName === 'theme-color-auto') {
                const manualToggle = document.getElementById('mdw_themeColorToggle');
                const globalButton = document.querySelector('[data-helper="toggleColorMode"]');

                if (state === 'on') {
                    if (manualToggle) manualToggle.style.opacity = '0.3';
                    if (globalButton) globalButton.style.opacity = '0.3';
                    if (typeof setThemeColor === 'function') setThemeColor();
                } else {
                    if (manualToggle) manualToggle.style.opacity = '1';
                    if (globalButton) globalButton.style.opacity = '1';
                }
            }

            if (typeof refreshLocalStorage === 'function') refreshLocalStorage();
        },

        updateFontSize: function(e, persist = false) {
            const val = e.target.value;
            const display = document.getElementById('mdw_themeFontSizeValue');
            const shownVal = parseFloat(val) + 25;

            if (display) display.textContent = shownVal + '%';
            mdw.session.theme.font.zoom = val;
            setDocumentAttribute('zoom-level', val);

            if (persist && typeof refreshLocalStorage === 'function') refreshLocalStorage();
        }
    },

    /**
     * internal helper to sync all color icons across the ui
     */
    _syncIcons: function(mode) {
        const nextIcon = mode === 'dark' ? 'ti-moon-filled' : 'ti-sun-filled';
        const prevIcon = mode === 'dark' ? 'ti-sun-filled' : 'ti-moon-filled';

        const internalIcon = document.querySelector('#mdw_themeColorToggle i');
        if (internalIcon) internalIcon.classList.replace(prevIcon, nextIcon);

        const globalIcon = document.querySelector('[data-helper="toggleColorMode"] i');
        if (globalIcon) globalIcon.className = `ti ${nextIcon}`;
    },

    content: function() {
        const t = mdw.session.theme;
        const shownFontSize = parseFloat(t.font.zoom) + 25;
        const isAuto = t.color.auto === 'on';

        return `<ul class="nav">
            <li class="menuitem" id="menu_theme_general">
                <a class="menu_parent" href="#" inert><i class="menu_glyph ti ti-photo"></i><span>General</span></a>
                <ul>
                    <li>
                        <div>Animations</div>
                        <div>
                            <label class="checkboxSwitch">
                                <input id="mdw_themeAnimations" class="formCheckbox" type="checkbox" ${t.boxes.animated === 'on' ? 'checked' : ''}>
                                <span class="checkboxSlider checkboxRound"></span>
                            </label>
                            <output id="mdw_themeAnimationsValue">${t.boxes.animated}</output>
                        </div>
                    </li>
                    <li>
                        <div>Show Control Names</div>
                        <div>
                            <label class="checkboxSwitch">
                                <input id="mdw_themeControlsSubTitle" class="formCheckbox" type="checkbox" ${t.controls.subTitle === 'on' ? 'checked' : ''}>
                                <span class="checkboxSlider checkboxRound"></span>
                            </label>
                            <output id="mdw_themeControlsSubTitleValue">${t.controls.subTitle}</output>
                        </div>
                    </li>
                    <li>
                        <div>Zoom Level</div>
                        <div>
                            <input class="mdw_themeFontSize" id="mdw_themeFontSize" type="range" min="50" max="100" step="2.5" value="${t.font.zoom}">
                            <output id="mdw_themeFontSizeValue">${shownFontSize}%</output>
                        </div>
                    </li>
                </ul>
            </li>
            <li class="menuitem" id="menu_theme_colors">
                <a class="menu_parent" href="#" inert><i class="menu_glyph ti ti-color-swatch"></i><span>Colors</span></a>
                <ul>
                    <li>
                        <div>Auto Mode</div>
                        <div>
                            <label class="checkboxSwitch">
                                <input id="mdw_themeColorModeAuto" class="formCheckbox" type="checkbox" ${isAuto ? 'checked' : ''}>
                                <span class="checkboxSlider checkboxRound"></span>
                            </label>
                            <output id="mdw_themeColorModeAutoValue">${t.color.auto}</output>
                        </div>
                    </li>
                    <li id="mdw_manualColorItem">
                        <div>Manual Toggle</div>
                        <div class="mdw-theme-toggle" id="mdw_themeColorToggle" role="button" tabindex="0" style="opacity: ${isAuto ? '0.3' : '1'}">
                            <i class="ti ${t.color.mode === 'dark' ? 'ti-moon-filled' : 'ti-sun-filled'}"></i>
                        </div>
                    </li>
                </ul>
            </li>
            <li class="menuitem" id="menu_theme_mobile">
                <a class="menu_parent" href="#" inert><i class="menu_glyph ti ti-device-mobile"></i><span>Mobile Devices</span></a>
                <ul>
                    <li>
                        <div>Auto Table Layout</div>
                        <div>
                            <label class="checkboxSwitch">
                                <input id="mdw_themeAutoTableLayout" class="formCheckbox" type="checkbox" ${t.mobile.autoTableLayout === 'on' ? 'checked' : ''}>
                                <span class="checkboxSlider checkboxRound"></span>
                            </label>
                            <output id="mdw_themeAutoTableLayoutValue">${t.mobile.autoTableLayout}</output>
                        </div>
                    </li>
                </ul>
            </li>
        </ul>`;
    },

    init: function($box) {
        const ns = midwinter.navigationBox.theme;
        const actions = ns._actions;
        const root = $box[0] || $box;

        const mappings = [
            { id: '#mdw_themeAnimations', path: 'boxes.animated', attr: 'animations' },
            { id: '#mdw_themeControlsSubTitle', path: 'controls.subTitle', attr: 'controls-subtitle' },
            { id: '#mdw_themeColorModeAuto', path: 'color.auto', attr: 'theme-color-auto' },
            { id: '#mdw_themeAutoTableLayout', path: 'mobile.autoTableLayout', attr: 'auto-table-layout' }
        ];

        mappings.forEach(m => {
            const el = root.querySelector(m.id);
            if (el) el.addEventListener('change', (e) => actions.toggleSetting(e, m.path, m.attr));
        });

        const slider = root.querySelector('#mdw_themeFontSize');
        if (slider) {
            slider.addEventListener('input', (e) => actions.updateFontSize(e, false));
            slider.addEventListener('change', (e) => actions.updateFontSize(e, true));
        }

        const toggle = root.querySelector('#mdw_themeColorToggle');
        if (toggle) toggle.addEventListener('click', actions.toggleColor);

        // sync global button opacity on init
        const globalButton = document.querySelector('[data-helper="toggleColorMode"]');
        if (globalButton) globalButton.style.opacity = (mdw.session.theme.color.auto === 'on') ? '0.3' : '1';
    }
};

// expose global bridge for the uiConfig button
window.toggleColorMode = midwinter.navigationBox.theme._actions.toggleColor;
// register plugin
midwinter.navigationBox.registerPlugin('midwinter.navigationBox.theme');