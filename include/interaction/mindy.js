/**
 * Mindy - MidWinter not dead yet
 * The Cacti Interaction Layer Middleware
 */
window.Mindy = (() => {
    // 1. Internal Storage & Parcel Box
    const _initialState = {
        legacyMode: false,
        plugins: {},
        registry: {},
        navigation: {
            dock: { enabled: true, top: true, left: true, right: true, bottom: true },
            overlay: { enabled: true }
        },
        context: {
            appearance: 'light', // 'light' or 'dark'
            current: { rubric: 'Console', category: '', action: '', helper: '' }
        },
        destructionList: [],
    };

    const _bus = new EventTarget();
    let _parcelBox = null;
    let _initialized = false;

    /**
     * Creates the hidden container for the Parcel Service
     */
    const _initParcelBox = () => {
        if (!document.getElementById('mindy-parcel-service')) {
            _parcelBox = document.createElement('div');
            _parcelBox.id = 'mindy-parcel-service';
            _parcelBox.style.display = 'none';
            document.body.appendChild(_parcelBox);
        } else {
            _parcelBox = document.getElementById('mindy-parcel-service');
        }
    };

    return {
        state: _initialState,

        /**
         * Initializes Mindy, applies the layout map and starts the observer
         */
        init: function(options = {}) {
            // Falls schon initialisiert, nur Optionen mergen und Map ausführen
            if (_initialized) {
                console.log('[Mindy] Already active. Re-applying Map...');
                // WICHTIG: Nur Optionen mergen, die nicht den aktuellen Context zerstören
                $.extend(true, this.state, options);
                this.ui.layout.applyMap();
                return;
            }

            console.log('[Mindy] Initializing Logistics & Interaction Layer...');
            $.extend(true, this.state, options);

            _initParcelBox();

            if (this.state.legacyMode) {
                console.log('[Mindy] Legacy Mode active.');
                return;
            }

            this.ui.layout.applyMap();
            this.observer.start(); // Observer wird NUR EINMAL gestartet

            _initialized = true; // Jetzt ist Mindy offiziell wach
            this.publish('mindy:ready', { timestamp: Date.now() });
        },

        // --- plugin loader ---
        loader: {
            _path: 'include/interaction/plugins/',

            /**
             * Loads a set of Mindy plugins and initializes them
             * @param {Array} plugins - List of plugin names (filenames without .js)
             */
            load: async function(plugins = []) {
                console.group('[Mindy Loader] Bootstrapping Plugins...');

                const loadPromises = plugins.map(name => {
                    const url = `${this._path}${name}.js`;
                    return new Promise((resolve, reject) => {
                        $.getScript(url)
                            .done(() => {
                                console.log(`[Mindy Loader] Plugin "${name}" loaded.`);
                                resolve(name);
                            })
                            .fail((jqxhr, settings, exception) => {
                                console.error(`[Mindy Loader] Failed to load "${name}":`, exception);
                                reject(exception);
                            });
                    });
                });

                try {
                    await Promise.all(loadPromises);
                    console.log('[Mindy Loader] All plugins loaded successfully.');

                    // Trigger initial state update for newly loaded plugins
                    Mindy.publish('mindy:plugins:ready', { count: plugins.length });
                } catch (e) {
                    console.error('[Mindy Loader] Error during plugin bootstrap.');
                }
                console.groupEnd();
            }
        },

        // --- Event Bus ---
        publish: (event, detail) => {
            _bus.dispatchEvent(new CustomEvent(event, { detail }));
        },

        subscribe: (event, callback) => {
            _bus.addEventListener(event, (e) => callback(e.detail));
        },

        // --- Plugin Management ---
        register: function(id, pluginObj) {
            this.state.plugins[id] = pluginObj;
            // Bridge to legacy navigationBox plugins if required
            if (window.midwinter && window.midwinter.navigationBox) {
                window.midwinter.navigationBox._plugins[id] = pluginObj;
            }
            this.publish('plugin:registered', { id: id });
        },

        // --- Context & Theme Management ---
        setContext: function(newContext) {
            if (!this.state.context.current) this.state.context.current = {};

            // 1. State synchronisieren
            $.extend(true, this.state.context.current, newContext);

            // 2. Automatischer UI-Anchor-Sync (NEU)
            // Findet alles mit data-mindy-context="rubric|category|action"
            Object.keys(newContext).forEach(key => {
                const value = newContext[key];
                const $anchors = $(`[data-mindy-context="${key}"]`);

                if ($anchors.length) {
                    // Action darf HTML enthalten (für Icons/Spezialfälle), der Rest ist Text
                    if (key === 'action') {
                        $anchors.html(value || '');
                    } else {
                        $anchors.text(value || '');
                    }
                }
            });

            // 3. Special handling for theme appearance (Alter Stand + Fix)
            if (newContext.appearance) {
                this.state.context.appearance = newContext.appearance;

                if (typeof window.setDocumentAttribute === 'function') {
                    window.setDocumentAttribute('theme-color', newContext.appearance);
                }
                this.publish('ux:colorMode:changed', { mode: newContext.appearance });
            }

            // 4. Globaler Event für Plugins
            this.publish('context:changed', this.state.context.current);
        },

        // --- UI & Logistics ---
        ui: {
            layout: {
                map: {}, // Populated via main.js (ThemeReady)
                isSyncing: false,

                /**
                 * The Postman: Delivers content from Cacti to a specific plugin mailbox
                 */
                deliver: function(sourceSelector, pluginId) {
                    const $source = $(sourceSelector);
                    if ($source.length) {
                        const safePluginId = pluginId.replace(':', '-');
                        let $mailbox = $(`#mindy-mailbox-${safePluginId}`);

                        if (!$mailbox.length) {
                            $mailbox = $(`<div id="mindy-mailbox-${safePluginId}"></div>`).appendTo('#mindy-parcel-service');
                        }

                        // --- FIX: Nur das NEUESTE Element nehmen und Mailbox radikal leeren ---
                        // Wir nehmen .last(), da Cacti bei AJAX oft das neue Element einfügt,
                        // bevor das alte komplett verschwunden ist.
                        const $latestContent = $source.last().detach();

                        // Mailbox leeren und ALLES darin vernichten (inkl. Events/Daten-Leichen)
                        $mailbox.empty().append($latestContent);

                        Mindy.publish('plugin:parcel:ready', {
                            id: pluginId,
                            mailboxId: `mindy-mailbox-${safePluginId}`
                        });
                        return true;
                    }
                    return false;
                },

                collect: function(pluginId) {
                    const safeId = pluginId.replace(':', '-');
                    const $mailbox = $(`#mindy-mailbox-${safeId}`);

                    if ($mailbox.length && $mailbox.children().length > 0) {
                        // Wir nehmen den Inhalt raus (detach)
                        const $content = $mailbox.children().detach();

                        // Mailbox als "leer" markieren oder aufräumen
                        $mailbox.empty();

                        console.log(`[Mindy] Parcel collected by ${pluginId}. Mailbox is now empty.`);
                        return $content;
                    }
                    return null;
                },

                relocate: function(sourceSelector, targetRef) {
                    // 1. Ziel auflösen (Selektor oder Anker)
                    let $target = (typeof targetRef === 'string' && (targetRef.startsWith('#') || targetRef.startsWith('.')))
                        ? $(targetRef)
                        : $(`[data-mindy-anchor="${targetRef}"]`);

                    if (!$target.length) return false;

                    // 2. Quelle flexibel handhaben (String-Selektor oder jQuery-Objekt)
                    let $source;
                    let marker;

                    if (typeof sourceSelector === 'string') {
                        marker = sourceSelector.replace(/[#.]/g, '');

                        // Dein bewährter Filter für globale Suchen
                        $source = $(sourceSelector).filter(function() {
                            const $el = $(this);
                            if ($el.is('[data-mindy-source]')) return false;
                            const isInsidePopover = $el.closest('#mdw-GridContainer-PopOver').length > 0;
                            const isInPopoverTarget = $target.closest('#mdw-GridContainer-PopOver').length > 0;

                            // Schutz vor "Diebstahl" aus Popovers
                            if (!isInPopoverTarget && isInsidePopover) return false;

                            const isNestedInTable = $el.closest('.cactiTable').length > 0;
                            if (sourceSelector === '.saveRow' || sourceSelector === '.actionsDropdown') {
                                return !isNestedInTable;
                            }
                            return true;
                        });
                    } else {
                        // Es ist bereits ein jQuery-Objekt (vom Transformer übergeben)
                        $source = sourceSelector;
                        // Wir brauchen trotzdem einen Marker für den Stacking-Schutz im Ziel
                        marker = $source.attr('id') || $source.attr('class')?.split(/\s+/)[0] || 'manual-relocate';
                    }

                    if ($source.length) {
                        // 3. Stacking-Schutz im Ziel
                        $target.find(`[data-mindy-source="${marker}"]`).detach();

                        // 4. Markieren und Umziehen
                        $source.attr('data-mindy-source', marker);
                        $source.detach().appendTo($target).show();

                        return true;
                    }
                    return false;
                },


                /**
                 * Processes the entire Logistics Map
                 */
                applyMap: function() {
                    if (this.isSyncing) return;
                    this.isSyncing = true;

                    if (Mindy.observer.instance) Mindy.observer.instance.disconnect();

                    const $popover = $('#mdw-GridContainer-PopOver');
                    const isPopoverActive = $popover.length && !$popover.hasClass('hidden');

                    if (!isPopoverActive) {
                        $('[data-mindy-anchor^="anchor-table"], [data-mindy-anchor^="anchor-ActionBarMiddle"]').empty();
                        console.log('[Mindy] Full Sync: Dynamic anchors cleared.');
                    } else {
                        console.log('[Mindy] Popover Sync: Preserving main anchors.');
                    }

                    // 1. Relocate & Deliver (Die Map)
                    const selectors = Object.keys(this.map).sort((a, b) => b.length - a.length);
                    selectors.forEach(source => {
                        const target = this.map[source];
                        target.startsWith('#') || target.startsWith('.') || target.startsWith('anchor-') ? this.relocate(source, target) : this.deliver(source, target);
                    });

                    // 2. DIE DESTRUCTION LIST (Hier wird aufgeräumt)
                    // Wir greifen über Mindy.state darauf zu
                    if (Mindy.state.destructionList && Mindy.state.destructionList.length) {
                        Mindy.state.destructionList.forEach(selector => {
                            $(selector).remove();
                        });
                    }

                    // 3. Transformers ausführen
                    Mindy.ui.transformers.apply($('#mdw-Main'));

                    const currentCtx = Mindy.state.context.current;
                    if (currentCtx) {
                        // Falls die "action" leer ist (wie im Log), nehmen wir den Seitentitel als Fallback
                        if (!currentCtx.action || currentCtx.action === '') {
                            currentCtx.action = document.title.split(' - ').pop();
                        }

                        Object.keys(currentCtx).forEach(key => {
                            // NATIVE SUCHE statt jQuery
                            const anchor = document.querySelector(`[data-mindy-context="${key}"]`);

                            //console.log(`[Mindy Debug] Key: ${key}, Value: ${currentCtx[key]}, Found Native:`, !!anchor);

                            if (anchor) {
                                if (key === 'action') {
                                    anchor.innerHTML = currentCtx[key] || '';
                                } else {
                                    anchor.textContent = currentCtx[key] || '';
                                }
                            }
                        });
                    }

                    this.isSyncing = false;
                    if (Mindy.observer.instance) {
                        Mindy.observer.instance.observe(document.body, { childList: true, subtree: true });
                    }

                    Mindy.publish('ui:content:ready', { timestamp: Date.now() });
                }
            },

            transformers: {
                registry: [],
                add: function(selector, transformFn) {
                    this.registry.push({ selector, transformFn });
                },
                apply: function($container) {
                    this.registry.forEach(t => {
                        $container.find(t.selector).addBack(t.selector).each((i, el) => {
                            t.transformFn($(el));
                        });
                    });
                }
            }
        },

        // --- Mutation Observer ---
        observer: {
            instance: null,
            start: function() {
                const callback = (mutations) => {
                    if (Mindy.ui.layout.isSyncing) return;

                    let shouldSync = false;
                    for (let m of mutations) {
                        // Ignoriere alles im neuen Grid und im Paket-Service
                        if ($(m.target).closest('#mdw-GridContainer, #mindy-parcel-service').length) continue;

                        // Prüfe auf gemappte Cacti-Elemente
                        const hasMappedNodes = Array.from(m.addedNodes).some(n =>
                                n.nodeType === 1 && Object.keys(Mindy.ui.layout.map).some(s =>
                                    n.matches?.(s) || (n.querySelector && n.querySelector(s))
                                )
                        );

                        if (hasMappedNodes) {
                            shouldSync = true;
                            break;
                        }
                    }

                    if (shouldSync) {
                        // Direktaufruf statt setTimeout für maximale Performance
                        Mindy.ui.layout.applyMap();
                    }
                };

                // FIX: Actually instantiate the MutationObserver!
                this.instance = new MutationObserver(callback);
                this.instance.observe(document.body, { childList: true, subtree: true });
            }
        },

        // --- Helper Services ---
        services: {
            setCookie: function(name, value) {
                const date = new Date();
                date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
                document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
            }
        },

        debugParcels: () => {
            const $service = $('#mindy-parcel-service');
            const mailboxes = $service.children();

            console.group('%c[Mindy Logistics Status]', 'color: #3498db; font-weight: bold;');
            console.log('Total Mailboxes:', mailboxes.length);

            mailboxes.each((i, el) => {
                const $box = $(el);
                const childCount = $box.children().length;
                const color = childCount > 1 ? 'color: #e74c3c;' : 'color: #2ecc71;'; // Rot bei Duplikaten

                console.group(`%cBox: ${el.id} (${childCount} Elements)`, color + 'font-weight: bold;');

                if (childCount === 0) {
                    console.warn('Empty Mailbox - Parcel might be lost or not delivered yet.');
                } else {
                    $box.children().each((j, child) => {
                        console.log(`[${j}]`, child.tagName, child.className || '(no class)', child);
                    });
                }
                console.groupEnd();
            });

            console.groupEnd();
        }
    };

})();
