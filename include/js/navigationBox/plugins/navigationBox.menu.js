var midwinter = midwinter || {};
midwinter.navigationBox = midwinter.navigationBox || {};

midwinter.navigationBox.menu = {
    // framework-State Update (Buttons/Visibility)
    _notifyState($box, hasContent) {
        const helper = ($box && typeof $box.data === 'function') ? $box.data('helper') : ($box.helper || 'menu');
        document.dispatchEvent(new CustomEvent('mdw:pluginStateUpdate', {
            detail: { helper: helper, hasContent: hasContent },
            bubbles: true
        }));
    },

    getDefaultConfig: function(overrides = {}) {

        const base = 'midwinter.navigationBox';
        const defaults = {
            title: 'Navigation',
            helper: 'menu',
            buttons: { search: 'searchToHighlight' },
            contentLoader: `${base}.menu.content`,
            initCallback: `${base}.menu.init`,
            contextMenuItems: {
                "reload": {
                    name: "Reload",
                    icon: "ti ti-refresh",
                    callback: "midwinter.navigationBox.menu.reload"
                }
            }
        };
        return $.extend(true, {}, defaults, overrides);
    },

    /**
     * returns the html container for the tree
     * @returns {string} html string
     */
    content: function() {
        return `<div class="mdw-menu-async-wrapper">
                    <ul class="nav"><li class="menuitem"><span>Loading...</span></li></ul>
                </div>`;
    },

    /**
     * Handles events and visibility notification and
     * triggers async fetch
     */
    init: function($box) {
        const ns = midwinter.navigationBox.menu;
        ns._notifyState($box, true);
        ns.loadAsync($box).catch(err => console.error('[Midwinter] Menu Error:', err));
    },

    /**
     * Reload callback triggered from the context menu
     * @param {string} key - the menu item key (e.g., 'reload')
     * @param {object} opt - the context menu options object
     */
    reload: function(key, opt) {
        const $box = opt.$trigger.closest('[class*="ConsoleNavigationBox"]');
        this.loadAsync($box).then(() => {
            //console.log(`[Midwinter] ${$box.data('helper')} reloaded successfully.`);
        }).catch(err => {
            console.error(`[Midwinter] ${$box.data('helper')} Reload failed:`, err);
        });
    },

    loadAsync: async function($box) {
        const ns = midwinter.navigationBox.menu;
        const helper = $box.data('helper');
        const $target = $box.find('.mdw-menu-async-wrapper');

        if (!$target.length) return;

        try {
            // fetch via Fetch-API (about.php)
            const html = await loadElement('menu', 'about.php', true);
            if (html && html.trim() !== '') {
                const finalHtml = (helper === 'settings') ? html : ns._buildDashboardHtml(html);

                $target.html(finalHtml);

                // register ajax functions and trigger
                if (typeof updateNavigation === 'function') updateNavigation();
                if (typeof updateAjaxAnchors === 'function') updateAjaxAnchors();

                ns._notifyState($box, true);
            }
        } catch (e) {
            $target.html('<ul class="nav"><li class="menuitem"><span>Error loading data.</span></li></ul>');
            ns._notifyState($box, false);
        }
    },

    _buildDashboardHtml: function(rawHtml) {
        const temp = document.createElement('div');
        temp.innerHTML = rawHtml;
        let html = '<ul class="nav">';

        // console / home
        if (window.cactiConsoleAllowed) {
            html += `<li class="menuitem" id="menu_home">
                <a class="menu_parent" href="#" inert><i class="menu_glyph ignore ti ti-crown"></i><span>${window.cactiHome}</span></a>
                <ul><li><a href="${urlPath}index.php" class="pic">${window.cactiConsole}</a></li></ul>
            </li>`;
        }

        // views (incl. items for Tree/List/Preview)
        if (window.cactiGraphsAllowed) {
            html += `<li class="menuitem" id="menu_tab_dashboard">
                <a class="menu_parent" href="#" inert><i class="menu_glyph ignore ti ti-device-desktop-analytics"></i><span>Views</span></a>
                <ul>
                    <li><a class="pic" id="tab-graphs-tree-view" href="${urlPath}graph_view.php?action=tree">Tree</a></li>
                    <li><a class="pic" id="tab-graphs-list-view" href="${urlPath}graph_view.php?action=list">List</a></li>
                    <li><a class="pic" id="tab-graphs-pre-view" href="${urlPath}graph_view.php?action=preview">Preview</a></li>
                </ul>
            </li>`;
        }

        // dynamic Plugin Tabs
        const tabs = temp.querySelectorAll('.maintabs nav ul li a.lefttab');
        let miscItems = '';
        tabs.forEach(tab => {
            const id = tab.id;
            const href = tab.getAttribute('href');
            if (id !== 'tab-console' && id !== 'tab-graphs' && href !== 'index.php') {
                const label = temp.querySelector('.text_' + id)?.textContent || id;
                miscItems += `<li><a class="pic" href="${href}">${label}</a></li>`;
            }
        });

        if (miscItems) {
            html += `<li class="menuitem" id="menu_tab_miscellaneous">
                <a class="menu_parent" href="#" inert><i class="menu_glyph ignore ti ti-puzzle"></i><span>${window.cactiMisc}</span></a>
                <ul>${miscItems}</ul>
            </li>`;
        }

        return html + '</ul>';
    }
};

midwinter.navigationBox.registerPlugin('midwinter.navigationBox.menu');
