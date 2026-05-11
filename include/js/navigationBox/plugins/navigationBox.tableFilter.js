/**
 * Mindy NavigationBox Plugin: Filter
 * Handles the integration of Cacti filter forms into the MidWinter sidebar.
 */
midwinter.navigationBox.filter = {
    getDefaultConfig: function(overrides = {}) {
        const base = 'midwinter.navigationBox.filter';
        return $.extend(true, {
            title: 'Filter',
            helper: 'displayFilterOptions',
            contentLoader: `${base}.content`,
            initCallback: `${base}.init`,
            isRefreshable: true,
        }, overrides);
    },

    /**
     * Mindy-Native Initialization
     * Listens for incoming parcels (Cacti filter forms) from the Mindy Parcel Service.
     */
    init: function($box) {
        const helper = $box.data('helper');
        const $myContainer = $box.find('.navBox-content');
        const pluginId = 'nav-filter'; // Matches the ID in Mindy.ui.layout.map

        console.log(`[Filter Plugin] Registered and waiting for parcels (ID: ${pluginId})`);

        /**
         * Subscribe to the Parcel Service
         */
        Mindy.subscribe('plugin:parcel:ready', (parcel) => {
            if (parcel.id === pluginId) {
                // Paket offiziell abholen (entnimmt es aus der Mindy-Mailbox)
                const $content = Mindy.ui.layout.collect(pluginId);

                if ($content && $content.length > 0) {
                    $myContainer.empty().append($content);

                    // Dem System melden: Ich habe Inhalt! (Wichtig für Sidebar-Buttons)
                    Mindy.publish('plugin:content:updated', { id: pluginId, hasContent: true });

                    // E: Visual polish (Ensure form and its elements are visible)
                    $myContainer.find('form').show().css({
                        'visibility': 'visible',
                        'display': 'block'
                    });

                    //Inform the UI Framework that content is present (show sidebar button)
                    if (window.mdw && window.mdw.obj.ctrl.nav) {
                        window.mdw.obj.ctrl.nav.setBoxPresence(helper, true);
                    }
                }else {
                    // If the parcel was empty (page has no filters), hide the box button
                    if (window.mdw && window.mdw.obj.ctrl.nav) {
                        window.mdw.obj.ctrl.nav.setBoxPresence(helper, false);
                    }
                }
            }
        });

        /**
         * Initial Check: If a parcel arrived before the plugin finished loading.
         * We check the mailbox manually once.
         */
        const initialMailboxId = `mindy-mailbox-${pluginId}`;
        const $initialMailbox = $(`#${initialMailboxId}`);

        if ($initialMailbox.length && $initialMailbox.children().length > 0) {
            Mindy.publish('plugin:parcel:ready', {
                id: pluginId,
                mailboxId: initialMailboxId
            });
        }
    },

    /**
     * Default content shown while waiting for Cacti to provide a filter
     */
    content: function() {
        return '<div class="mdw-filter-placeholder">Searching for Cacti filters...</div>';
    },
};

// Official registration with Mindy
Mindy.register('filter', midwinter.navigationBox.filter);
