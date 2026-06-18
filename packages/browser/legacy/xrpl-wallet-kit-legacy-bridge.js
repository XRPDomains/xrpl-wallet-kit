(function (window, document) {
  'use strict';

  function mapAdapterIdToLegacy(adapterId) {
    var map = {
      staticbit: 'staticbitwallet',
      bitget: 'bitgetwallet',
      joey: 'joeywallet',
      girin: 'girinwallet',
      bifrost: 'bifrostwallet'
    };
    return map[adapterId] || adapterId;
  }

  function mapLegacyAdapterIdToKit(adapterId) {
    var map = {
      staticbitwallet: 'staticbit',
      bitgetwallet: 'bitget',
      joeywallet: 'joey',
      girinwallet: 'girin',
      bifrostwallet: 'bifrost',
      ledgerwallet: 'ledger'
    };
    return map[adapterId] || adapterId;
  }

  function getPathValue(source, path) {
    return path.split('.').reduce(function (value, key) {
      return value && typeof value === 'object' ? value[key] : undefined;
    }, source);
  }

  function inferMethodHint(txJson, options) {
    if (options && options.methodHint) return options.methodHint;
    if (options && options.gemMethod === 'sendPayment') return 'payment';
    if (options && options.gemMethod === 'createNFTOffer') return 'createNFTOffer';
    if (options && options.gemMethod === 'acceptNFTOffer') return 'acceptNFTOffer';
    if (options && options.gemMethod === 'cancelNFTOffer') return 'cancelNFTOffer';
    if (options && options.gemMethod === 'burnNFT') return 'burnNFT';
    if (options && (options.gemMethod === 'setTrustline' || options.gemMethod === 'addTrustline')) return 'setTrustline';

    var transactionType = txJson && txJson.TransactionType;
    if (transactionType === 'Payment') return 'payment';
    if (transactionType === 'NFTokenCreateOffer') return 'createNFTOffer';
    if (transactionType === 'NFTokenAcceptOffer') return 'acceptNFTOffer';
    if (transactionType === 'NFTokenCancelOffer') return 'cancelNFTOffer';
    if (transactionType === 'NFTokenBurn') return 'burnNFT';
    if (transactionType === 'TrustSet') return 'setTrustline';
    return 'generic';
  }

  function createTxJsonFromWalletPayload(options, address) {
    var payload = options && (options.walletPayload || options.gemPayload);
    if (!payload || !address) return null;

    if (options.gemMethod === 'sendPayment' || options.methodHint === 'payment') {
      return cleanTxJson({
        TransactionType: 'Payment',
        Account: address,
        Destination: payload.destination || payload.Destination,
        Amount: payload.amount || payload.Amount
      });
    }

    if (options.gemMethod === 'createNFTOffer' || options.methodHint === 'createNFTOffer') {
      return cleanTxJson({
        TransactionType: 'NFTokenCreateOffer',
        Account: address,
        NFTokenID: payload.NFTokenID || payload.nftokenID || payload.nfTokenId,
        Amount: payload.amount || payload.Amount,
        Flags: payload.flags || payload.Flags,
        Owner: payload.owner || payload.Owner,
        Destination: payload.destination || payload.Destination
      });
    }

    if (options.gemMethod === 'acceptNFTOffer' || options.methodHint === 'acceptNFTOffer') {
      return cleanTxJson({
        TransactionType: 'NFTokenAcceptOffer',
        Account: address,
        NFTokenSellOffer: payload.NFTokenSellOffer || payload.sellOffer,
        NFTokenBuyOffer: payload.NFTokenBuyOffer || payload.buyOffer,
        NFTokenBrokerFee: payload.NFTokenBrokerFee || payload.brokerFee
      });
    }

    if (options.gemMethod === 'cancelNFTOffer' || options.methodHint === 'cancelNFTOffer') {
      return cleanTxJson({
        TransactionType: 'NFTokenCancelOffer',
        Account: address,
        NFTokenOffers: payload.NFTokenOffers || payload.offers
      });
    }

    if (options.gemMethod === 'burnNFT' || options.methodHint === 'burnNFT') {
      return cleanTxJson({
        TransactionType: 'NFTokenBurn',
        Account: address,
        NFTokenID: payload.NFTokenID || payload.nftokenID || payload.nfTokenId,
        Owner: payload.Owner || payload.owner
      });
    }

    if (options.gemMethod === 'setTrustline' || options.gemMethod === 'addTrustline' || options.methodHint === 'setTrustline' || options.methodHint === 'trustSet' || options.methodHint === 'trustset') {
      return cleanTxJson({
        TransactionType: 'TrustSet',
        Account: address,
        LimitAmount: payload.LimitAmount || payload.limitAmount,
        Flags: payload.Flags || payload.flags,
        QualityIn: payload.QualityIn || payload.qualityIn,
        QualityOut: payload.QualityOut || payload.qualityOut
      });
    }

    return null;
  }

  function cleanTxJson(txJson) {
    if (!txJson || typeof txJson !== 'object') return txJson;
    var cleaned = {};
    Object.keys(txJson).forEach(function (key) {
      if (txJson[key] !== undefined && txJson[key] !== null && txJson[key] !== '') cleaned[key] = txJson[key];
    });
    return cleaned;
  }

  function normalizeWalletKitTxResult(result) {
    if (!result) return { hash: undefined, status: undefined, raw: result };
    return {
      hash: result.hash || getPathValue(result, 'raw.hash') || getPathValue(result, 'raw.result.hash'),
      status: result.status || getPathValue(result, 'raw.engine_result') || getPathValue(result, 'raw.result.meta.TransactionResult'),
      signed: result.signed,
      rejected: result.rejected,
      raw: result.raw || result
    };
  }

  function defaultNotify(type, message) {
    if (typeof window.notify === 'function') window.notify(type, message);
  }

  function resolveElement(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    return target;
  }

  function ensureMount(target, options) {
    var mount = resolveElement(target);
    if (mount) return mount;

    var anchor = resolveElement(options && options.anchor);
    mount = document.createElement('div');
    mount.id = options && options.id ? options.id : 'xrpl-wallet-kit-button';
    mount.className = options && options.className ? options.className : 'xwk-legacy-mount';
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(mount, anchor.nextSibling);
    } else {
      document.body.appendChild(mount);
    }
    return mount;
  }

  function injectFallbackStyles() {
    if (document.getElementById('xwk-legacy-bridge-styles')) return;
    var style = document.createElement('style');
    style.id = 'xwk-legacy-bridge-styles';
    style.textContent = '.xwk-legacy-mount{align-items:center;display:flex;justify-content:center;min-height:48px}.xwk-legacy-fallback{align-items:center;background:#f8fafc;border:1px solid rgba(15,23,42,.12);border-radius:14px;box-shadow:none;color:#172033;cursor:pointer;display:inline-flex;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;font-weight:560;gap:8px;min-height:46px;overflow:hidden;padding:0 8px 0 10px;touch-action:manipulation;transition:background-color .16s ease,opacity .16s ease;white-space:nowrap}.xwk-legacy-fallback:hover{background:#eef3f8;box-shadow:none;transform:none}.xwk-legacy-fallback:active{opacity:.78;transform:none}.xwk-legacy-icon,.xwk-legacy-chevron{align-items:center;background:#fff;border:1px solid rgba(15,23,42,.12);box-sizing:border-box;color:#64748b;display:inline-flex;justify-content:center;overflow:hidden}.xwk-legacy-icon{border-radius:10px;flex:0 0 30px;height:30px;line-height:0;width:30px}.xwk-legacy-icon svg{display:block;flex:0 0 17px;height:17px;width:17px}.xwk-legacy-label{min-width:0;overflow:hidden;text-overflow:ellipsis}.xwk-legacy-chevron{border-radius:999px;flex:0 0 28px;height:28px;line-height:1;width:28px}';
    document.head.appendChild(style);
  }

  function renderFallbackButton(label) {
    return '<span class="xwk-legacy-icon" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h11.5A1.5 1.5 0 0 1 20 6.5V9H7A2.5 2.5 0 0 1 4.5 6.5v1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 9h15.5A2.5 2.5 0 0 1 22 11.5v5A2.5 2.5 0 0 1 19.5 19h-13A2.5 2.5 0 0 1 4 16.5V9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 13.5h5V17h-5a1.75 1.75 0 1 1 0-3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span><span class="xwk-legacy-label">' + label + '</span><span class="xwk-legacy-chevron" aria-hidden="true">v</span>';
  }

  function ensureFallbackButton(mount, kit, label) {
    if (!mount) return null;
    injectFallbackStyles();
    var button = mount.querySelector('.xwk-legacy-fallback');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'xwk-legacy-fallback';
      button.innerHTML = renderFallbackButton(label || 'Connect Wallet');
      mount.appendChild(button);
    }
    button.onclick = function () {
      if (kit && typeof kit.openModal === 'function') kit.openModal();
    };
    return button;
  }

  function createIdentityResolver(options) {
    if (options.identityResolver) return options.identityResolver;
    if (!options.identityEndpoint && !options.identityProfileEndpoint) return undefined;
    if (!window.XRPLWalletKit || !window.XRPLWalletKit.createXrpDomainsResolver) return undefined;
    return window.XRPLWalletKit.createXrpDomainsResolver({
      endpoint: options.identityEndpoint,
      profileEndpoint: options.identityProfileEndpoint
    });
  }

  function createDefaultUi(options) {
    return {
      mode: options.themeMode || 'light',
      customTheme: Object.assign({
        accent: '#0078ae',
        radius: '18px',
        walletRadius: '18px',
        shadow: 'none'
      }, options.theme || {}),
      modal: Object.assign({
        title: 'Connect Wallet',
        width: 'default',
        footerText: 'XRPL Wallet Kit'
      }, options.modal || {}),
      walletList: Object.assign({
        layout: 'list',
        wallets: 'all',
        showGroup: true,
        showInstalledBadge: true
      }, options.walletList || {}),
      walletConnect: Object.assign({ mode: 'group', cta: 'both', qr: { style: 'dots', showLogo: false } }, options.walletConnect || {}),
      connectButton: Object.assign({
        label: options.connectLabel || 'Connect Wallet',
        showAdapterIcon: true,
        showChevron: true,
        showBalance: options.showBalance !== false,
        showWeb3Name: options.showWeb3Name !== false,
        size: options.buttonSize || 'lg',
        variant: 'default'
      }, options.connectButton || {}),
      accountPanel: Object.assign({
        mode: options.accountPanelMode || 'modal',
        copyAddress: true,
        disconnect: true,
        explorer: false
      }, options.accountPanel || {}),
      identity: Object.assign({
        enabled: options.showWeb3Name !== false,
        fallbackToAddress: true,
        resolver: createIdentityResolver(options)
      }, options.identity || {})
    };
  }


  function mergeUiConfig(base, overrides) {
    overrides = overrides || {};
    return Object.assign({}, base, overrides, {
      customTheme: Object.assign({}, base.customTheme || {}, overrides.customTheme || {}),
      modal: Object.assign({}, base.modal || {}, overrides.modal || {}),
      walletList: Object.assign({}, base.walletList || {}, overrides.walletList || {}),
      walletConnect: Object.assign({}, base.walletConnect || {}, overrides.walletConnect || {}, {
        qr: Object.assign({}, (base.walletConnect && base.walletConnect.qr) || {}, (overrides.walletConnect && overrides.walletConnect.qr) || {})
      }),
      connectButton: Object.assign({}, base.connectButton || {}, overrides.connectButton || {}),
      accountPanel: Object.assign({}, base.accountPanel || {}, overrides.accountPanel || {}),
      identity: Object.assign({}, base.identity || {}, overrides.identity || {})
    });
  }
  function createKitOptions(options, mount) {
    var ui = mergeUiConfig(createDefaultUi(options), options.ui);
    return Object.assign({
      appName: options.appName || document.title || 'XRPL dApp',
      appDescription: options.appDescription || '',
      appUrl: options.appUrl || window.location.origin,
      appIcons: options.appIcons || [],
      network: options.network || 'mainnet',
      storage: options.storage || 'localStorage',
      autoReconnect: options.autoReconnect !== false,
      xamanClientId: options.xamanClientId,
      walletConnectProjectId: options.walletConnectProjectId,
      walletConnectSignMessageDestination: options.walletConnectSignMessageDestination,
      wallets: options.wallets || ['xaman', 'gemwallet', 'crossmark', 'dropfi', 'xrplsnap', 'walletconnect'],
      ui: ui,
      identity: options.identityRoot,
      connectButton: Object.assign({
        target: mount,
        label: options.connectLabel || 'Connect Wallet',
        showAdapterIcon: true,
        showChevron: true,
        showBalance: options.showBalance !== false,
        showWeb3Name: options.showWeb3Name !== false,
        size: options.buttonSize || 'lg',
        variant: 'default'
      }, options.connectButton || {})
    }, options.kit || {});
  }

  function mount(options) {
    options = options || {};
    if (!window.XRPLWalletKit || typeof window.XRPLWalletKit.create !== 'function') {
      console.warn('XRPLWalletKit browser bundle is not loaded.');
      return null;
    }

    var legacyButton = resolveElement(options.legacyButton || options.button);
    var mountEl = ensureMount(options.target || options.mount || '#xrpl-wallet-kit-button', {
      anchor: legacyButton,
      className: options.mountClassName || 'xwk-legacy-mount',
      id: options.mountId
    });
    ensureFallbackButton(mountEl, null, options.connectLabel || 'Connect Wallet');

    var kit;
    try {
      kit = window.XRPLWalletKit.create(createKitOptions(options, mountEl));
    } catch (error) {
      console.error('XRPL Wallet Kit create failed:', error);
      ensureFallbackButton(mountEl, null, options.connectLabel || 'Connect Wallet');
      if (legacyButton && legacyButton.style) legacyButton.style.display = '';
      return null;
    }

    if (!mountEl.children.length) ensureFallbackButton(mountEl, kit, options.connectLabel || 'Connect Wallet');
    var fallback = mountEl.querySelector('.xwk-legacy-fallback');
    if (fallback) fallback.onclick = function () { kit.openModal(); };
    if (legacyButton && mountEl.children.length && options.hideLegacyButton !== false) legacyButton.style.display = 'none';

    var hiddenAddress = resolveElement(options.hiddenAddress);
    var notify = options.notify || defaultNotify;
    var completingConnection = false;

    function setLegacyLoading(isLoading) {
      if (typeof options.setLegacyLoading === 'function') options.setLegacyLoading(isLoading);
    }

    async function syncSession(session) {
      if (!session || completingConnection || (options.getIsConnected && options.getIsConnected())) return;
      completingConnection = true;
      setLegacyLoading(true);
      try {
        var legacy = {
          adapter: mapAdapterIdToLegacy(session.adapterId),
          adapterId: session.adapterId,
          icon: session.wallet && session.wallet.icon ? session.wallet.icon : '',
          address: session.account.address,
          session: session
        };
        if (hiddenAddress) hiddenAddress.value = legacy.address;
        if (typeof options.onSession === 'function') await options.onSession(session, legacy, kit);
        if (typeof options.onConnected === 'function') await options.onConnected(session, legacy, kit);
      } catch (error) {
        notify('error', error && error.message ? error.message : String(error || 'Wallet connection failed'));
        if (typeof options.onError === 'function') options.onError(error, kit);
      } finally {
        completingConnection = false;
        setLegacyLoading(false);
      }
    }

    kit.manager.on('connecting', function () { setLegacyLoading(true); });
    kit.manager.on('connected', function (event) { syncSession(event.session || kit.manager.getSession()); });
    kit.manager.on('disconnected', function () {
      setLegacyLoading(false);
      if (typeof options.onDisconnected === 'function') options.onDisconnected(kit);
      if (options.reloadOnDisconnect === true) window.setTimeout(function () { window.location.reload(); }, 80);
    });
    kit.manager.on('error', function (event) {
      setLegacyLoading(false);
      if (typeof options.onError === 'function') options.onError(event.error, kit);
    });

    var restoredSession = kit.manager.getSession();
    if (restoredSession) syncSession(restoredSession);
    if (options.autoReconnect !== false) {
      kit.manager.autoReconnect().then(function (session) {
        if (session) syncSession(session);
      }).catch(function (error) {
        console.warn('XRPL Wallet Kit autoReconnect failed:', error);
      });
    }

    return kit;
  }

  function patchLegacyFacade(options) {
    options = options || {};
    var facade = options.facade;
    var kit = options.kit;
    if (!facade || !kit || !kit.manager) {
      console.warn('XRPLWalletKitLegacyBridge.patchLegacyFacade requires a facade and mounted kit.');
      return facade;
    }

    facade.__legacy = {
      connect: facade.connect,
      disconnect: facade.disconnect,
      signAuthPayload: facade.signAuthPayload,
      signAndSubmit: facade.signAndSubmit
    };

    facade.connect = async function (adapterName) {
      var kitAdapterId = mapLegacyAdapterIdToKit(adapterName || (options.getAdapter && options.getAdapter()) || '');
      var session = kit.manager.getSession() || await kit.manager.connect(kitAdapterId);
      return {
        address: session.account.address,
        networkType: session.account.network && session.account.network.networkType ? session.account.network.networkType : session.account.networkType,
        adapter: mapAdapterIdToLegacy(session.adapterId),
        session: session
      };
    };

    facade.disconnect = async function () {
      await kit.manager.disconnect();
      if (typeof options.onDisconnect === 'function') await options.onDisconnect();
    };

    facade.signAuthPayload = async function (message) {
      var result = await kit.manager.signMessage({ message: message });
      return result.proof || result.signature || result.txBlob || result.raw;
    };

    facade.signAndSubmit = async function (txJson, requestOptions) {
      requestOptions = requestOptions || {};
      var account = kit.manager.getAccount();
      var address = account && account.address ? account.address : (options.getCurrentAddress && options.getCurrentAddress());
      var resolvedTxJson = cleanTxJson(txJson || createTxJsonFromWalletPayload(requestOptions, address));
      if (!resolvedTxJson) throw new Error('Unable to build transaction payload for wallet-kit signAndSubmit.');
      var result = await kit.manager.signAndSubmit({
        txJson: resolvedTxJson,
        walletPayload: requestOptions.walletPayload || requestOptions.gemPayload || resolvedTxJson,
        methodHint: inferMethodHint(resolvedTxJson, requestOptions),
        submit: requestOptions.submit !== false
      });
      return normalizeWalletKitTxResult(result);
    };

    facade.getWalletKit = function () { return kit; };
    return facade;
  }

  window.XRPLWalletKitLegacyBridge = {
    mount: mount,
    patchLegacyFacade: patchLegacyFacade,
    mapAdapterIdToLegacy: mapAdapterIdToLegacy,
    mapLegacyAdapterIdToKit: mapLegacyAdapterIdToKit
  };
})(window, document);
