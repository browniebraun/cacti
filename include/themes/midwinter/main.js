/*
  +-------------------------------------------------------------------------+
  | Copyright (C) 2004-2026 The Cacti Group                                 |
  |                                                                         |
  | This program is free software; you can redistribute it and/or           |
  | modify it under the terms of the GNU General Public License             |
  | as published by the Free Software Foundation; either version 2          |
  | of the License, or (at your option) any later version.                  |
  |                                                                         |
  | This program is distributed in the hope that it will be useful,         |
  | but WITHOUT ANY WARRANTY; without even the implied warranty of          |
  | MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           |
  | GNU General Public License for more details.                            |
  +-------------------------------------------------------------------------+
  | Cacti: The Complete RRDTool-based Graphing Solution                     |
  +-------------------------------------------------------------------------+
  | This code is designed, written, and maintained by the Cacti Group. See  |
  | about.php and/or the AUTHORS file for specific developer information.   |
  +-------------------------------------------------------------------------+
  | http://www.cacti.net/                                                   |
  +-------------------------------------------------------------------------+
*/

select2Setup = {
	displayDefaultLabel : true
}

/* registry object to use separate namespaces */
const registry = {};

/* midwinter session object */
let mdw = {
    session: {
        theme: {
            boxes:      { animated: 'on' },
            color:      { mode: 'dark', auto: 'off' },
            controls:   { subTitle: 'off', tooltip: 'on' },
            font:       { zoom: 75 },
            mobile:     { autoTableLayout: 'off' },
        },
    },
    obj: { box: {}, ctrl: {} },
	actions: {
	},
	domMap: {
		cactiContent:       '#cactiContent',
		cactiNavRight:      '#navigation_right',
		cactiBreadcrumb:    '#breadCrumbBar',
		cactiTable:         '.cactiTable',
		sortInfo:           'div.sortinfo',
		mdwMain:            '#mdw-Main',
		mdwGrid:            '#mdw-GridContainer',
		mdwPopOver:         '#mdw-GridContainer-PopOver',
		mdwActionBarTop:    '#mdw-ActionBarTop',
		cactiAuthBody:   	'.cactiAuthBody',				// login rewrite
		cactiAuthArea:   	'.cactiAuthArea legend',
		cactiAuthTable:  	'.cactiAuthTable',
		cactiAuthForm:   	'.cactiAuth',
		versionInfo:     	'.versionInfo',
		loginUsername:   	'#login_username'
	},
    cache: {
        classes:    [],
        path:       'include/js/navigationBox/',
        storage:    Storages.localStorage,
        tap:        { count: 0, clientX: 0, clientY: 0 },
		colorListenerActive: false,
		ajaxAnchorsActive: false
    }
}

mdw.cache.colorListener = (e) => {
	const isDark = mdw.cache.systemQuery.matches;
	mdw.actions.checkThemeColorSetup(isDark ? 'dark' : 'light');
};

document.addEventListener('mdw:pluginStateUpdate', (e) => {
	// in VanillaJS CustomEvent-Data is available in .detail
	const data = e.detail || e.originalEvent?.detail;

	const { nav: navManager, btn: btnManager } = mdw.obj.ctrl;

	// sync Button visibility
	if (typeof btnManager?.show === 'function') {
		data.hasContent ? btnManager.show(data.helper) : btnManager.hide(data.helper);
	}

	// sync Box Presence
	if (typeof navManager?.setBoxPresence === 'function') {
		navManager.setBoxPresence(data.helper, data.hasContent);
	}
});

/**
 * helper to safely move elements using the mapping
 * @param {string} sourceKey - key from mdw.domMap
 * @param {string} targetKey - key from mdw.domMap
 */
mdw.actions.relocate = function(sourceKey, targetKey) {
	// always query fresh from dom because of cacti's ajax content updates
	const source = document.querySelector(mdw.domMap[sourceKey]);
	const target = document.querySelector(mdw.domMap[targetKey]);

	// verify both elements exist before moving
	if (source && target) {
		target.appendChild(source);
		return true;
	}
	return false;
};

mdw.actions.hotkeyRegistry = {
	refreshContent: () => {
		if (typeof togglePopOver === 'function') togglePopOver(false);
		if (typeof loadUrl === 'function') {
			loadUrl({ url: window.location.href });
		} else {
			window.location.reload();
		}
	},
	closeOverlays: () => {
		if (typeof togglePopOver === 'function') togglePopOver(false);
		if (getDocumentAttribute('kiosk-mode') === 'on') {
			kioskMode(false);
		}
	}
};

/**
 * initialize global hotkey dispatcher
 * uses event.code for numbers to avoid shift-key character translation issues
 */
mdw.actions.initHotKeys = function() {
	// prevent multiple listener attachments
	if (mdw.cache.hotkeysActive) return;

	document.addEventListener('keydown', (event) => {
		// skip only if user is actively typing in an input field
		const activeEl = document.activeElement;
		const isTyping = activeEl && (
			['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
			activeEl.isContentEditable
		);

		if (isTyping) return;

		const parts = [];
		if (event.ctrlKey)  parts.push('CTRL');
		if (event.altKey)   parts.push('ALT');
		if (event.shiftKey) parts.push('SHIFT');

		let keyName = '';
		if (event.code.startsWith('Digit')) {
			keyName = event.code.slice(5);
		} else if (event.code.startsWith('Numpad') && event.code.length === 7) {
			keyName = event.code.slice(6);
		} else {
			keyName = event.key.toUpperCase();
		}

		if (keyName === 'ESCAPE') keyName = 'ESC';
		if (keyName === ' ')      keyName = 'SPACE';
		if (['CONTROL', 'ALT', 'SHIFT'].includes(keyName)) return;

		parts.push(keyName);
		const combo = parts.join('+');

		// 1. check for global virtual actions (e.g., ESC to exit Kiosk)
		const virtualAction = uiConfig.global.hotkeys.find(h => h.combo === combo);
		if (virtualAction && typeof mdw.actions.hotkeyRegistry[virtualAction.action] === 'function') {
			event.preventDefault();
			// Stop propagation only for handled actions
			event.stopImmediatePropagation();
			mdw.actions.hotkeyRegistry[virtualAction.action]();
			return;
		}

		// 2. check for elements with data-hotkey
		const targetEl = document.querySelector(`[data-hotkey="${combo}"]`);
		if (targetEl && (targetEl.offsetWidth > 0 || targetEl.offsetHeight > 0)) {
			event.preventDefault();
			event.stopImmediatePropagation();

			// use native click
			targetEl.click();
		}
	}, true); // useCapture enabled to catch events early

	mdw.cache.hotkeysActive = true;
};


/**
 * validates and applies color mode changes if necessary
 * @param {string} colorMode - 'dark' or 'light'
 */
mdw.actions.checkThemeColorSetup = function(colorMode) {
	// get current attribute from document for comparison
	const currentDocMode = getDocumentAttribute('theme-color');

	// get current cookie if available
	const currentCookie = typeof getCookieValue === 'function' ? getCookieValue('CactiColorMode') : null;

	// only trigger update if mode actually changed to prevent loops
	if (currentDocMode !== colorMode || currentCookie !== colorMode) {

		// update the session object
		// only if not in auto-mode, otherwise we just sync the UI state
		if (mdw.session.theme.color.auto !== 'on') {
			mdw.session.theme.color.mode = colorMode;
		} else {
			// in auto-mode, we still want the internal mode to reflect reality
			mdw.session.theme.color.mode = colorMode;
		}

		// persist the changes to local storage
		if (typeof refreshLocalStorage === 'function') {
			refreshLocalStorage();
		}

		// IMPORTANT: apply the attributes to the DOM immediately
		// previously this might have been missing or only called on full refresh
		if (typeof mdw.actions.applyThemeState === 'function') {
			mdw.actions.applyThemeState();
		}

		// sync with server-side cookie
		if (typeof setCookieValue === 'function') {
			setCookieValue('CactiColorMode', colorMode);
		}

		// refresh cacti graphs with new color context
		if (typeof initializeGraphs === 'function') {
			initializeGraphs(true);
		}

		console.log('[Midwinter] Theme color applied:', colorMode);
	}
};



/**
 * main entry point for applying all session-based theme settings
 * modernized to use native batch updates
 */
mdw.actions.applyThemeState = function() {
	const storage = mdw.cache.storage;

	// handle data retrieval from local storage
	if (!storage || !storage.isSet('midWinter')) {
		if (typeof refreshLocalStorage === 'function') refreshLocalStorage();
	} else {
		try {
			mdw.session = JSON.parse(lzjs.decompress(storage.get('midWinter')));
		} catch (e) {
			console.error('[Midwinter] storage corruption, resetting...');
			if (typeof refreshLocalStorage === 'function') refreshLocalStorage();
		}
	}

	// apply attributes to documentElement (ui logic)
	const theme = mdw.session.theme;
	const attrs = {
		'theme-color':       theme.color.mode,
		'theme-color-auto':  theme.color.auto,
		'zoom-level':        theme.font.zoom,
		'animations':        theme.boxes.animated,
		'auto-table-layout': theme.mobile.autoTableLayout,
		'controls-subtitle': theme.controls.subTitle
	};

	// batch update data-attributes using native forEach
	Object.keys(attrs).forEach(key => {
		setDocumentAttribute(key, attrs[key]);
	});
};

mdw.actions.finalizeLayout = function() {
	setupDefaultElements();
	updateNavigation();
	updateAjaxAnchors();
	setThemeColor();

	//hideConsoleNavigation();
	setupThemeActions();

	// set PWA Layout attribute
	checkPWADisplayMode();
}

mdw.uiObserver = {
	instance: null,

	init: function() {
		// prevention: if an observer is already running, do nothing
		if (this.instance) return;

		const targetNode = document.body;
		const config = { childList: true, subtree: true };

		this.instance = new MutationObserver((mutations) => {
			let needsRelocate = false;
			const navRightSelector = mdw.domMap.cactiNavRight;

			for (const mutation of mutations) {
				// we only care about added elements
				for (const node of mutation.addedNodes) {
					// skip text nodes or non-element nodes
					if (node.nodeType !== 1) continue;

					// check if the node itself or one of its children is our target
					if (node.matches(navRightSelector) || node.querySelector(navRightSelector)) {
						needsRelocate = true;
						break;
					}
				}
				if (needsRelocate) break;
			}

			if (needsRelocate) {
				// pause: temporarily disconnect to prevent infinite loops during DOM moves
				this.instance.disconnect();

				// action: relocate content using our helper
				mdw.actions.relocate('cactiNavRight', 'mdwMain');

				// refresh cacti defaults and theme logic
				if (typeof setupDefaultElements === 'function') setupDefaultElements();
				if (typeof setupThemeActions === 'function') setupThemeActions();

				// resume: re-observe after changes are done
				this.instance.observe(targetNode, config);
			}
		});

		this.instance.observe(targetNode, config);
		console.log('[Midwinter] MutationObserver initialized.');
	}
};


/**
 * handles the one-time loading of all theme dependencies
 * @returns {Promise}
 */
async function initMidwinter() {
	// return immediately if core plugins are already in cache
	if (mdw.cache.classes.includes('navigationBox.filter')) {
		return;
	}

	try {
		// load configuration and core logic first
		await Promise.all([
			loadScript('config', 'include/themes/midwinter/config.js'),
			loadScript('navigationBox', mdw.cache.path + 'navigationBox.js')
		]);

		// load all navigation plugins in parallel
		await Promise.all([
			loadScript('navigationBox.help', mdw.cache.path + '/plugins/navigationBox.help.js'),
			loadScript('navigationBox.menu', mdw.cache.path + '/plugins/navigationBox.menu.js'),
			loadScript('navigationBox.tree', mdw.cache.path + '/plugins/navigationBox.tree.js'),
			loadScript('navigationBox.tableLayout', mdw.cache.path + '/plugins/navigationBox.tableLayout.js'),
			loadScript('navigationBox.filter', mdw.cache.path + '/plugins/navigationBox.tableFilter.js'),
			// load theme specific plugin from the theme directory
			loadScript('navigationBox.theme', 'include/themes/midwinter/navigationBox.theme.js')
		]);

	} catch (error) {
		console.error('[Midwinter] bootstrap failed', error);
	}
}

//restoreLocalStorage();

/**
 * called by cacti whenever a page or ajax fragment is ready
 */
function themeReady() {
	// apply immediate layout states that don't depend on scripts
	mdw.actions.applyThemeState();

	// ensure all dependencies are loaded before proceeding
	initMidwinter().then(() => {
		// initialize core logic
		setupTheme();
		mdw.actions.initHotKeys();

		// process layout and plugins
		mdw.actions.finalizeLayout();

		// enable observer last
		mdw.uiObserver?.init?.();

		// remove overlay
		themeLoader?.('off');

		console.log('[Midwinter] UI fully initialized and reactive.');
	});
}

function checkPWADisplayMode() {
	// initial setup
	let displayModeQuery = window.matchMedia('(display-mode: standalone)');
	setDocumentAttribute('theme-pwa', (displayModeQuery.matches) ? 'on' : 'off' );

	// monitor changes
	displayModeQuery.addEventListener('change', (e) => {
		setDocumentAttribute('theme-pwa', (e.matches) ? 'on' : 'off' );

	});

	// TODO conflict with fullscreen mode
}

/**
 * handles global ajax navigation and resolves overlap with cacti's internal ajaxAnchors()
 * uses event delegation to be robust against cacti's frequent applySkin() calls
 */
function updateAjaxAnchors() {
	// singleton guard: only attach the global delegate once
	if (mdw.cache.ajaxAnchorsActive) return;

	document.addEventListener('click', function(event) {
		// 1. check if the click should be captured (ignore if Shift/Alt/Ctrl/Meta is pressed)
		// this mirrors cacti's native shouldCaptureClick(event) logic
		if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}

		// 2. find the closest matching anchor
		const anchor = event.target.closest('a.pic, a.linkOverDark, a.linkEditMain, a.console, a.hyperLink, a.tab');
		if (!anchor) return;

		const href = anchor.getAttribute('href');

		// 3. validation check (ignore external, anchors, or mailto)
		if (!href || href === '#' || href.startsWith('http') || anchor.getAttribute('target') === '_blank' || href.startsWith('mailto:')) {
			return;
		}

		// 4. take control: prevent Cacti's native ajaxAnchors() from firing
		event.preventDefault();
		event.stopImmediatePropagation();

		/* midwinter specific ui logic */
		if (anchor.classList.contains('pic')) {
			document.querySelectorAll('a.pic.selected').forEach(el => el.classList.remove('selected'));
			anchor.classList.add('selected');
		}

		/* handle mobile/sidebar logic */
		if (window.innerWidth < 640 && typeof menuHide === 'function') {
			menuHide(false);
		}

		// close midwinter console navigation boxes
		const sideBarBoxes = document.querySelectorAll('#mdw-SideBarContainer [class^="mdw-ConsoleNavigationBox"]');
		sideBarBoxes.forEach(box => box.classList.remove('visible'));

		/* determine pageName for cacti global scope */
		if (typeof basename === 'function') {
			window.pageName = basename(href);
		}

		/* trigger cacti's internal loader */
		if (typeof loadUrl === 'function') {
			loadUrl({
				url: href,
				loadType: 'loadPage'
			});
		}
	}, true); // useCapture = true to intercept before cacti's core listeners

	mdw.cache.ajaxAnchorsActive = true;
	console.log('[Midwinter] Global AJAX anchor delegation active with keyboard modifier support.');
}



/**
 * updates the breadcrumb navigation based on the active menu element
 * @param {HTMLElement} element - the native anchor element
 */
function midWinterNavigation(element) {
	const menuItem = element.closest('.menuitem');
	const parentBox = element.closest('div[class^="mdw-ConsoleNavigationBox"]');

	// extract core data
	const helper = parentBox?.dataset.helper;
	const rubric = parentBox?.dataset.title;

	// handle the "tree_content" special case
	const currentUrl = window.location.href;
	let categoryText = menuItem?.querySelector('.menu_parent span')?.textContent || '';
	let actionHTML = element.parentElement.innerHTML;

	/* --- Inside midWinterNavigation --- */
	if (currentUrl.includes('action=tree_content') || currentUrl.includes('action=tree')) {
		// apply workaround: if category is missing in tree mode, set it to "Node"
		if (!categoryText || categoryText.trim() === '') {
			categoryText = 'Node';
		}

		// clean up document title to extract the pure node or graph name
		// this regex removes common cacti prefixes and handles separators like " - "
		let pageTitle = document.title;

		/*
         * replace common cacti title prefixes
         * matches patterns like "Cacti - ", "Cacti [1.2.x] - ", "Graph View - " etc.
         */
		const cleanTitle = pageTitle
			.replace(/^Cacti\s*(?:\[.*?\])?\s*-\s*/i, '') // removes "Cacti - " or "Cacti - "
			.replace(/^Graph View\s*-\s*/i, '')           // removes "Graph View - "
			.replace(/^Console\s*-\s*/i, '');             // removes "Console - "

		actionHTML = `<span>${cleanTitle}</span>`;
	}

	const btnManager = mdw.obj.ctrl.btn;

	// update rubric
	const rubricEl = document.querySelector('#navBreadCrumb .rubric');
	if (rubricEl) {
		rubricEl.innerHTML = `<span>${rubric}</span>`;
		rubricEl.dataset.helper = helper;
		rubricEl.onclick = () => btnManager?.toggleConsoleNavigationBox({ data: { param: 'force_open', filter: 'reset' } });
	}

	// update category
	const categoryEl = document.querySelector('#navBreadCrumb .category');
	if (categoryEl) {
		categoryEl.innerHTML = `<span>${categoryText}</span>`;
		categoryEl.dataset.helper = helper;
		categoryEl.onclick = () => btnManager?.toggleConsoleNavigationBox({ data: { param: 'force_open', filter: categoryText } });
	}

	// update action
	const actionEl = document.querySelector('#navBreadCrumb .action');
	if (actionEl) {
		actionEl.innerHTML = actionHTML;
	}
}


/**
 * finds the best matching navigation link for the current browser location
 */
function updateNavigation() {
	const currentPath = window.location.pathname;
	const currentSearch = window.location.search;
	const fullTarget = currentPath + currentSearch;

	// parse actual url parameters to get the real action
	const urlParams = new URLSearchParams(currentSearch);
	const realAction = urlParams.get('action');

	// define search patterns in order of specificity
	const patterns = [
		`a[href$="${fullTarget}"]`, // exact match with search params
		`a[href$="${currentPath}${currentSearch ? currentSearch : ''}"]`,
		`a[href$="${currentPath}"]`,
		`a[href$="${currentPath}index.php"]`
	];

	// if we found a real action in the url, prioritize it
	if (realAction) {
		patterns.push(`a[href*="action=${realAction}"]`);
	}

	// final fallback for the path
	patterns.push(`a[href^="${currentPath}"]`);

	const navContainers = document.querySelectorAll('div[class^="mdw-ConsoleNavigationBox"]');

	for (const pattern of patterns) {
		for (const container of navContainers) {
			const match = container.querySelector(pattern);
			if (match) {
				midWinterNavigation(match);
				return;
			}
		}
	}
}


/**
 * main theme setup logic
 * handles login ui rewrites, main layout transformation and component initialization
 */
function setupTheme() {
	/* login and logout rewrite */
	const authBody = document.querySelector(mdw.domMap.cactiAuthBody);
	const authArea = document.querySelector(mdw.domMap.cactiAuthArea);

	if (authBody && authArea?.textContent !== 'WELCOME TO CACTI') {
		authArea.textContent = 'WELCOME TO CACTI';

		const authTable = document.querySelector(mdw.domMap.cactiAuthTable);
		const authForm = document.querySelector(mdw.domMap.cactiAuthForm);

		if (authTable && authForm) {
			/* suppress autofocus issues */
			authForm.insertAdjacentHTML('afterbegin', '<input id="suppress_autofocus" type="text" style="display:none;" tab-index="-1" autofocus>');

			const pwdPlaceholders = {
				'current': 'Current Password',
				'password': 'New Password',
				'password_confirm': 'Confirm Password'
			};

			/* process table elements and transform to modern layout */
			authTable.querySelectorAll('input, button, label').forEach(el => {
				const type = el.getAttribute('type');
				const id = el.id;

				authForm.appendChild(el);

				if (type === 'password' && pwdPlaceholders[id]) {
					el.setAttribute('placeholder', pwdPlaceholders[id]);
					el.insertAdjacentHTML('afterend', `<i class="ti ti-lock" data-helper="${id}" data-func="togglePwdInputField"></i>`);
				}
			});

			/* handle welcome message and version info */
			const welcomeCell = authTable.querySelector('td');
			if (welcomeCell) {
				authForm.insertAdjacentHTML('afterbegin', `<span>${welcomeCell.innerHTML}</span>`);
			}

			const versionInfo = document.querySelector(mdw.domMap.versionInfo);
			if (versionInfo) authBody.appendChild(versionInfo);

			const loginUser = document.querySelector(mdw.domMap.loginUsername);
			if (loginUser) loginUser.insertAdjacentHTML('afterend', '<i class="ti ti-user"></i>');

			authTable.remove();
		}
	}

	/* layout redesign */
	const cactiContent = document.querySelector(mdw.domMap.cactiContent);
	const breadcrumb = document.querySelector(mdw.domMap.cactiBreadcrumb);

	if (cactiContent && breadcrumb) {
		const gridHTML = `
			<div id="mdw-GridContainer" class="mdw-GridContainer">
				<div id="mdw-GridContainer-Overlay" class="mdw-GridContainer-Overlay mdw-PopOver hidden"></div>
				<div id="mdw-GridContainer-PopOver" class="mdw-GridContainer-PopOver mdw-PopOver hidden">
					<div id="mdw-PopOverTitle" class="mdw-PopOverElements mdw-PopOverTitle"></div>
					<div id="mdw-PopOverContent" class="mdw-PopOverElements mdw-PopOverContent"></div>
					<div id="mdw-PopOverFooter" class="mdw-PopOverElements mdw-PopOverFooter"></div>
				</div>
				<div id="mdw-ConsoleNavigation" class="mdw-ConsoleNavigation"></div>
				<div id="mdw-ConsolePageHead" class="mdw-ConsolePageHead">
					<div id="navBreadCrumb" class="navBreadCrumb">
						<div class="home"><a href="${urlPath}index.php" class="pic">Home</a></div>
						<div class="rubric"></div><div class="category"></div><div class="action"></div>
					</div>
					<div id="navSearch" class="navSearch"></div>
					<div id="navFilter" class="navFilter"></div>
					<div id="navControl" class="navControl"></div>
				</div>
				<div id="mdw-Main" class="mdw-Main"></div>
				<div id="mdw-ActionBar" class="mdw-ActionBar">
					<div id="mdw-ActionBarTop" class="mdw-ActionBarTop"></div>
					<div id="mdw-ActionBarMiddle" class="mdw-ActionBarMiddle"></div>
					<div id="mdw-ActionBarBottom" class="mdw-ActionBarBottom"></div>
				</div>
			</div>`;

		breadcrumb.insertAdjacentHTML('beforebegin', gridHTML);
		mdw.actions.relocate('cactiNavRight', 'mdwMain');
		cactiContent.remove();
	}

	/* console navigation area */
	const consoleNav = document.querySelector('.mdw-ConsoleNavigation');
	if (consoleNav) {
		if (!document.getElementById('navBackdrop')) {
			consoleNav.innerHTML = `
				<div class="compact_nav_icon_menu">
					<div class="compact_nav_icon hint--info hint--right hint--rounded" 
						 data-subtitle="Console" id="navBackdrop" aria-label="Console" 
						 role="button" tabindex="0">
						<div class="navBackdrop"></div>
					</div>
				</div>`;

			document.getElementById('navBackdrop').addEventListener('click', () => {
				document.querySelectorAll('[class^="cactiConsoleNavigation"]').forEach(el => el.classList.remove('visible'));
				if (typeof loadUrl === 'function' && window.cactiConsoleAllowed) {
					loadUrl({ url: urlPath + 'index.php' });
				} else {
					window.open('https://cacti.net', '_blank');
				}
			});
		}

		if (!document.getElementById('compact_tab_menu')) {
			consoleNav.insertAdjacentHTML('beforeend', `
				<div class="compact_nav_icon_menu" id="compact_tab_menu"></div>
				<div class="compact_nav_icon_menu" id="compact_user_menu"></div>
			`);

			if (typeof cactiNavigation === 'function') {
				const navManager = new cactiNavigation({ dock: { top: false, bottom: false }, window: { enabled: false } });
				const boxManager = new cactiBox();
				const btnManager = new cactiButton();

				mdw.obj.ctrl.nav = navManager;
				mdw.obj.ctrl.box = boxManager;
				mdw.obj.ctrl.btn = btnManager;

				const processedBoxConfigs = midwinter.navigationBox.buildConfigs(uiConfig.boxes);

				navManager.checkConfigurationIntegrity(processedBoxConfigs, uiConfig.buttons);

				// register buttons and include hotkey attribute from config
				uiConfig.buttons.forEach(btn => {
					// the btnManager.add will now handle the rendering including data-hotkey
					btnManager.add(btn);
				});

				processedBoxConfigs.forEach(box => {
					boxManager.add(box);
					boxManager.restore(box.helper);
				});
			}
		}
	}

	/* clean up legacy elements */
	document.getElementById('menu_main_console')?.remove();
	document.querySelectorAll('a.menu_parent').forEach(el => {
		el.classList.remove('mdw-active');
		el.inert = true;
	});
}


function setupThemeActions() {
/*
	$('[data-scope="theme"][id^="mdw_"]:not([type="range"]), ' +
		'a[data-scope="theme"], ' +
		'i[data-func!=""][data-func]'
	).off().on('click', function(e) {
		let fname = $(this).attr('data-func');
		if(is_function(fname)) window[fname](e);
	});

	$('input[type="range"][data-scope="theme"][id^="mdw_"]').off().on('change', function(e) {
		let fname = $(this).attr('data-func');
		if(is_function(fname)) window[fname](e);
	});
*/
	document.addEventListener("fullscreenchange", fullScreenChangeHandler);

	// make popover draggable
	$('#mdw-GridContainer-PopOver').draggable({
		containment: '#mdw-GridContainer',
		scroll: false,
		start: function() {
			$(this).css('transform', 'translateX(0)');
		}
	});

	$('.graphPage').off().on('resize', function() { alert(); })
}

function redirect(event) {
	event.preventDefault();
	window.location = event.data.param;
}

function togglePwdInputField(event) {
	// get helper id from data attribute
	const helper = event.target.getAttribute('data-helper');

	// find destination input via native id selector
	const destination = document.getElementById(helper);

	if (destination) {
		// toggle between password and text type
		if (destination.type === 'password') {
			destination.type = 'text';
		} else {
			destination.type = 'password';
		}

		// toggle icon classes using native classList
		event.target.classList.toggle('ti-lock');
		event.target.classList.toggle('ti-lock-off');
	}
}

/**
 * handles the restructuring of cacti table elements into midwinter layout
 * modernized to avoid redundant DOM operations
 */
function setupDefaultElements() {
	const popover = document.querySelector(mdw.domMap.mdwPopOver);

	// only proceed if popover is hidden (active page layout)
	if (popover && popover.classList.contains('hidden')) {

		// cleanup legacy cacti elements
		const legacyElements = document.querySelectorAll(mdw.domMap.cactiBreadcrumb + ', .cactiPageHead, .cactiShadow, .cactiConsoleNavigationArea, .stickyContainer');
		legacyElements.forEach(el => el.remove());

		// ensure elementsOnTop container is available
		let onTop = document.getElementById('elementsOnTop');
		if (!onTop) {
			const navRight = document.querySelector(mdw.domMap.cactiNavRight);
			if (navRight) {
				navRight.insertAdjacentHTML('afterbegin', `
					<div id="elementsOnTop" class="elementsOnTop">
						<div id="tableTitleOnTop" class="elementOnTop tableTitleOnTop"></div>
						<div id="tableNavBarOnTop" class="elementOnTop tableNavBarOnTop"></div>
						<div id="tableActionOnTop" class="elementOnTop tableActionOnTop"></div>
						<div id="tableTabsOnTop" class="elementOnTop tableTabsOnTop"></div>
					</div>`);
				onTop = document.getElementById('elementsOnTop');
			}
		}

		// clear temporary containers before re-filling
		document.querySelectorAll(".elementOnTop, #mdw-ActionBarMiddle").forEach(el => el.innerHTML = '');

		// move table elements to midwinter containers
		const main = document.getElementById('main');
		if (main) {
			// move tabs
			const tabs = main.querySelector('div.tabs:first-child');
			if (tabs) {
				const tabContainer = document.getElementById('tableTabsOnTop');
				if (tabContainer) tabContainer.appendChild(tabs.closest('div'));
			}

			// move table title and actions
			const titleRow = main.querySelector('div.cactiTableTitleRow');
			if (titleRow) {
				const title = titleRow.querySelector('.cactiTableTitle');
				const action = titleRow.querySelector('.cactiTableAction:not(:empty)');
				const buttons = titleRow.querySelector('.cactiTableButton:not(:empty)');

				if (title) document.getElementById('tableTitleOnTop').appendChild(title);
				if (action) document.getElementById('tableActionOnTop').appendChild(action);
				if (buttons) document.getElementById('mdw-ActionBarMiddle').appendChild(buttons);

				titleRow.remove();
			}

			// handle save rows and nav bars
			const saveRow = main.querySelector('div.saveRow');
			const actionDrop = main.querySelector('div.actionsDropdown');

			if (saveRow) {
				document.getElementById('tableActionOnTop').appendChild(saveRow);
			} else if (actionDrop) {
				document.getElementById('tableActionOnTop').appendChild(actionDrop);
			}

			const navBar = main.querySelector('div.navBarNavigation');
			if (navBar) {
				document.getElementById('tableNavBarOnTop').appendChild(navBar.cloneNode(true));
			}
		}

		// modernize filter inputs
		const filters = [
			{ id: 'filter',  placeholder: window.searchFilter },
			{ id: 'filterd', placeholder: window.searchFilter },
			{ id: 'rfilter', placeholder: window.searchRFilter }
		];

		filters.forEach(f => {
			const el = document.getElementById(f.id);
			if (el && !el.nextElementSibling?.classList.contains('ti-search')) {
				el.insertAdjacentHTML('afterend', '<i class="ti ti-search filter"></i>');
				el.setAttribute('autocomplete', 'off');
				el.setAttribute('placeholder', f.placeholder || '');
				el.classList.add('ui-state-default', 'ui-corner-all');

				const parentTd = el.closest('td');
				if (parentTd) parentTd.style.whiteSpace = 'nowrap';
			}
		});

		// apply global styles to inputs
		document.querySelectorAll('input[type="text"], input[type="password"], input[type="checkbox"], textarea')
			.forEach(el => el.classList.add('ui-state-default', 'ui-corner-all'));

		// legacy row fix
		document.querySelectorAll('tr[id*="line"]:not(.disabled_row) .formCheckboxLabel')
			.forEach(label => label.removeAttribute('for'));

		// trigger plugin refresh
		if (typeof midwinter?.navigationBox?.refreshPlugins === 'function') {
			midwinter.navigationBox.refreshPlugins();
		}

		if (typeof setNavigationScroll === 'function') setNavigationScroll();
	}
}




function refreshLocalStorage() {
    mdw.cache.storage.set('midWinter', lzjs.compress(JSON.stringify(mdw.session)));
}

/**
 * sets a data attribute on the document element
 * @param {string} name - attribute name (without data- prefix)
 * @param {string} value - value to set
 */
function setDocumentAttribute(name, value) {
	// native setAttribute on <html> element
	document.documentElement.setAttribute('data-' + name, value);
	// update CSS variable
	if (name === 'zoom-level') {
		document.documentElement.style.setProperty('--mdw-zoom', value + '%');
	}
}

/**
 * retrieves a data attribute from the document element
 * @param {string} name - attribute name (without data- prefix)
 * @returns {string|null}
 */
function getDocumentAttribute(name) {
	// native getAttribute from <html> element
	return document.documentElement.getAttribute('data-' + name);
}



function themeLoader(state='off', force = false) {
	if (state === 'on') {
		if (getDocumentAttribute('data-theme-state') !== 'ready' || force === true) {
			setDocumentAttribute('theme-state', 'loading');
		}
	} else {
		setDocumentAttribute('theme-state', 'ready');
	}
}


function setCookieValue(name, value) {
	const days = 365;
	const date = new Date();
	date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));

	const expires = "; expires=" + date.toUTCString();
	const secure = (window.location.protocol === "https:") ? "; Secure" : "";
	const path = "; path=" + (typeof urlPath !== 'undefined' ? urlPath : '/') + "; SameSite=Lax";

	document.cookie = name + "=" + (value || "") + expires + path + secure;
}

function getCookieValue(name) {
	const nameEQ = name + "=";
	const ca = document.cookie.split(';');
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) === ' ') c = c.substring(1, c.length);
		if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
	}
	return null;
}

/**
 * synchronizes theme color settings and handles auto-detection
 */
function setThemeColor() {
	const themeColorInput = document.getElementById('mdw_themeColorMode');
	if (themeColorInput) {
		themeColorInput.disabled = (mdw.session.theme.color.auto === 'on');
	}
	detectSystemColorSetup(mdw.session.theme.color.auto);
}

/**
 * manages the system-level color scheme observer
 * @param {string} state - 'on' or 'off'
 */
function detectSystemColorSetup(state) {
	// singleton: ensure the MediaQueryList object exists only once
	if (!mdw.cache.systemQuery) {
		mdw.cache.systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
	}

	const mql = mdw.cache.systemQuery;

	if (state === 'on') {
		// guard: only attach the listener if it's not already marked as active
		if (!mdw.cache.colorListenerActive) {

			// helper to support both modern and legacy browsers (Ubuntu/Webkit)
			if (mql.addEventListener) {
				mql.addEventListener('change', mdw.cache.colorListener);
			} else {
				mql.addListener(mdw.cache.colorListener);
			}

			mdw.cache.colorListenerActive = true;
			console.log('[Midwinter] System color observer attached (Singleton).');
		}

		// perform immediate sync regardless of listener attachment
		mdw.actions.checkThemeColorSetup(mql.matches ? 'dark' : 'light');

	} else {
		// stop observing if it was active
		if (mdw.cache.colorListenerActive) {
			if (mql.removeEventListener) {
				mql.removeEventListener('change', mdw.cache.colorListener);
			} else {
				mql.removeListener(mdw.cache.colorListener);
			}

			mdw.cache.colorListenerActive = false;
			console.log('[Midwinter] System color observer detached.');
		}

		// return to manual session mode
		mdw.actions.checkThemeColorSetup(mdw.session.theme.color.mode);
	}
}

/**
 * processes html content for the popover and manages its sub-elements
 * @param {string} html - the raw html content from cacti
 */
function preparePopOver(html) {
	// get references to the main popover containers
	const popover = document.getElementById('mdw-GridContainer-PopOver');
	const screenOverlay = document.getElementById('mdw-GridContainer-Overlay');

	if (popover && screenOverlay) {
		// locate target sub-elements for title, content and footer
		const titleTarget = popover.querySelector('.mdw-PopOverTitle');
		const contentTarget = popover.querySelector('.mdw-PopOverContent');
		const footerTarget = popover.querySelector('.mdw-PopOverFooter');

		// create a temporary container to parse the incoming html string
		const temp = document.createElement('div');
		temp.innerHTML = html;

		// extract specific cacti elements (title row and save row) from the source
		const titleSource = temp.querySelector('.cactiTableTitleRow');
		const footerSource = temp.querySelector('.saveRow');

		// move elements to their respective targets if found
		if (contentTarget) {
			contentTarget.innerHTML = '';
			contentTarget.appendChild(temp);
		}

		if (titleTarget && titleSource) {
			titleTarget.innerHTML = '';
			titleTarget.appendChild(titleSource);
		}

		if (footerTarget && footerSource) {
			footerTarget.innerHTML = '';
			footerTarget.appendChild(footerSource);
		}

		// sanitize and re-bind the cancel button functionality
		const cancelButtons = popover.querySelectorAll('button[value="cancel"]');
		cancelButtons.forEach(btn => {
			// remove any inline onclick handlers and set fresh native listener
			btn.onclick = null;
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				togglePopOver(false);
			}, { once: true });
		});

		// handle the confirm action form submission
		const confirmForm = popover.querySelector('#action_confirm');
		if (confirmForm) {
			confirmForm.addEventListener('submit', () => {
				togglePopOver(false);
			}, { once: true });
		}

		// finally display the popover
		togglePopOver(true);
	}
}

/**
 * toggles the visibility of the popover and its overlay
 * @param {boolean|null} force - optional state to enforce
 */
function togglePopOver(force) {
	// get all elements with the popover class (container and overlay)
	const popovers = document.querySelectorAll('.mdw-PopOver');

	popovers.forEach(el => {
		if (typeof force === 'boolean') {
			// enforce specific state if provided
			if (force === true) {
				el.classList.remove('hidden');
			} else {
				el.classList.add('hidden');
			}
		} else {
			// toggle class if no force state is defined
			el.classList.toggle('hidden');
		}
	});
}

function fullScreen(event) {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().then( r => fullScreenChangeHandler() );
	}else if (document.exitFullscreen) {
		document.exitFullscreen().then( r => fullScreenChangeHandler() );
	}
}

function fullScreenChangeHandler() {
	const icon = document.querySelector('.compact_nav_icon[data-helper="fullScreen"] > i');
	if (!icon) return;

	if (document.fullscreenElement) {
		icon.classList.replace('ti-maximize', 'ti-minimize');
	} else {
		icon.classList.replace('ti-minimize', 'ti-maximize');
	}
}

function kioskMode(event = false) {
	const mainElement = document.querySelector(mdw.domMap.mdwMain);
	const btnManager = mdw.obj.ctrl.btn;

	if (event === false) {
		setDocumentAttribute('kiosk-mode', 'off');

		if (mainElement) {
			mainElement.removeEventListener('click', handleKioskClick);
		}
		mdw.cache.tap.count = 0;
	} else {
		// use button manager to close open console navigation box
		if (btnManager && typeof btnManager.toggleConsoleNavigationBox === 'function') {
			btnManager.toggleConsoleNavigationBox(event);
		}

		setDocumentAttribute('kiosk-mode', 'on');

		if (typeof isMobile !== 'undefined' && isMobile.any() !== null && mainElement) {
			mainElement.addEventListener('click', handleKioskClick);
		}
	}
}

/**
 * separate handler for double-tap detection
 */
function handleKioskClick(e) {
	mdw.cache.tap.count++;

	if (mdw.cache.tap.count === 1) {
		mdw.cache.tap.clientX = e.clientX;
		mdw.cache.tap.clientY = e.clientY;

		mdw.cache.tap.timer = setTimeout(function() {
			mdw.cache.tap.count = 0;
		}, 300);

	} else if (mdw.cache.tap.count === 2) {
		if (Math.abs(e.clientX - mdw.cache.tap.clientX) < 20 && Math.abs(e.clientY - mdw.cache.tap.clientY) < 20) {
			e.preventDefault();
			clearTimeout(mdw.cache.tap.timer);
			kioskMode(false);
		} else {
			mdw.cache.tap.count = 1;
			mdw.cache.tap.clientX = e.clientX;
			mdw.cache.tap.clientY = e.clientY;
		}
	}
}

/**
 * loads scripts via native dom injection and returns a promise
 * @param {string} className - unique name for the class
 * @param {string} url - relative path to the script
 * @returns {Promise} resolves when script is loaded
 */
function loadScript(className, url = '') {
	if (mdw.cache.classes.includes(className)) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		if (typeof urlPath === 'undefined' || !urlPath) {
			const location = window.location.pathname;
			const dirname = location.substring(0, location.lastIndexOf("/") + 1);
			urlPath = (dirname.search('/install/') !== -1) ? dirname + '../' : dirname;
		}

		const script = document.createElement('script');
		script.src = urlPath + url;
		script.async = false; // keep order

		script.onload = () => {
			mdw.cache.classes.push(className);
			resolve();
		};

		script.onerror = () => {
			console.error(`[Midwinter] failed to load: ${className}`);
			reject();
		};

		document.head.appendChild(script);
	});
}

/**
 * loads a specific element from a remote url using the fetch api
 * @param {string} elementName - the id of the element to extract
 * @param {string} url - the relative url to fetch from
 * @param {boolean} content_only - if true, only returns the inner html
 * @returns {Promise<string>}
 */
async function loadElement(elementName, url = '', content_only = false) {
	try {
		const path = (typeof urlPath !== 'undefined') ? urlPath : '';

		// fetch naturally includes cookies for same-origin requests
		const response = await fetch(path + url, {
			method: 'GET',
			cache: 'no-cache'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const html = await response.text();

		// parse html string natively
		const temp = document.createElement('div');
		temp.innerHTML = html;
		const targetElement = temp.querySelector('#' + elementName);

		if (!targetElement) {
			return '';
		}

		return content_only ? targetElement.innerHTML : targetElement.outerHTML;

	} catch (error) {
		console.error(`[Midwinter] loadElement failed:`, error);
		if (typeof getPresentHTTPError === 'function') {
			getPresentHTTPError(error);
		}
		return '';
	}
}

function is_function(f_name) {
	return (typeof window[f_name] === 'function');
}




registry.midwinter = {
	navigationBox : {
		content: {
			help: function() {
				return '<ul class="nav">'
						+   '<li class="menuitem" id="menu_user_help">'
						+       '<a class="menu_parent" href="#" inert>'
						+           '<i class="menu_glyph ti ti-book"></i>'
						+           '<span>'+cactiGeneral+'</span>'
						+       '</a>'
						+       '<ul>'
						+           '<li><a class="pic" role="menuitem" href="'+urlPath+'about.php">'+aboutCacti+'</a></li>'
						+           '<li><a href="https://github.com/Cacti/documentation/blob/develop/README.md" target="_blank" rel="noopener noreferrer">'+cactiDocumentation+'</a></li>'
						+           '<li><a href="https://github.com/cacti" target="_blank" rel="noopener noreferrer">'+cactiProjectPage+'</a></li>'
						+           '<li><a href="https://www.cacti.net" target="_blank" rel="noopener noreferrer">'+cactiHome+'</></a></li>'
						+       '</ul>'
						+   '</li>'
						+   '<li class="menuitem" id="menu_user_issues">'
						+       '<a class="menu_parent" href="#" inert>'
						+           '<i class="menu_glyph ti ti-bug"></i>'
						+           '<span>'+reportABug+'</span>'
						+       '</a>'
						+       '<ul>'
						+           '<li><a href="https://github.com/Cacti/cacti/issues/new/choose" target="_blank" rel="noopener noreferrer">'+justCacti+'</></a></li>'
						+           '<li><a href="https://github.com/Cacti/documentation/issues/new/choose" target="_blank" rel="noopener noreferrer">'+cactiDocumentation+'</></a></li>'
						+           '<li><a href="https://github.com/Cacti/spine/issues/new/choose" target="_blank" rel="noopener noreferrer">'+cactiSpine+'</a></li>'
						+           '<li><a href="https://github.com/Cacti/rrdproxy/issues/new/choose" target="_blank" rel="noopener noreferrer">'+cactiRRDProxy+'</a></li>'
						+       '</ul>'
						+   '</li>'
						// +   '<li class="menuitem" id="menu_user_shortcuts">'
						// +       '<a class="menu_parent" href="#" inert>'
						// +           '<i class="menu_glyph ti ti-keyboard"></i>'
						// +           '<span>'+cactiKeyboard+'</span>'
						// +       '</a>'
						// +       '<ul>'
						// +           '<li><a href="#" class="dialog_client" data-scope="theme" data-func="togglePopOver">'+cactiShortcuts+'</a></li>'
						// +       '</ul>'
						// +   '</li>'
						+   '<li class="menuitem" id="menu_user_help">'
						+       '<a class="menu_parent" href="#" inert>'
						+           '<i class="menu_glyph ti ti-heart-handshake"></i>'
						+           '<span>'+cactiContributeTo+'</span>'
						+       '</a>'
						+       '<ul>'
						+           '<li><a href="https://forums.cacti.net/" target="_blank" rel="noopener noreferrer">'+cactiCommunityForum+'</a></li>'
						+           '<li><a href="https://github.com/cacti" target="_blank" rel="noopener noreferrer">'+cactiDevHelp+'</a></li>'
						+           '<li><a href="https://www.cacti.net/development/contribute" target="_blank" rel="noopener noreferrer">'+cactiDonate+'</a></li>'
						+           '<li><a href="https://translate.cacti.net" target="_blank" rel="noopener noreferrer">'+cactiTranslate+'</a></li>'
						+       '</ul>'
						+   '</li>'
						+   '</ul>';
			},
			user: function() {
					return '<ul class="nav">'
						+   '<li class="menuitem" id="menu_user_action">'
						+       '<a class="menu_parent" href="#" inert>'
						+           '<i class="menu_glyph ti ti-user-edit""></i>'
						+           '<span>'+cactiProfile+'</span>'
						+       '</a>'
						+       '<ul>'
						+           '<li><a class="pic" role="menuitem" href="'+urlPath+'auth_profile.php?action=edit&header=false">'+editProfile+'</a></li>'
						+           '<li><a href="'+urlPath+'auth_changepassword.php" style="">'+changePassword+'</a></li>'
						+           '<li><a href="'+urlPath+'logout.php">'+logout+'</a></li>'
						+       '</ul>'
						+   '</li>';
			}
		}
	}
}