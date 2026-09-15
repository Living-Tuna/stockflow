'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ecbillsBridge', {
  version: '1.0.0',

  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),
  getStatus: () => ipcRenderer.invoke('status:get'),
  checkOrigin: (origin) => ipcRenderer.invoke('origin:check', origin),

  addProduct: (productData, companyId) => ipcRenderer.invoke('products:add', { productData, companyId }),
  listProducts: (companyId) => ipcRenderer.invoke('products:list', companyId),
  setProductSku: (productId, companyId, sku) => ipcRenderer.invoke('products:set-sku', { productId, companyId, sku }),

  makeBarcode: (text, type) => ipcRenderer.invoke('barcode:make', { text, type }),
  printLabels: (labels, columns, deviceName) => ipcRenderer.invoke('labels:print', { labels, columns, deviceName }),
  listPrinters: () => ipcRenderer.invoke('printers:list'),

  setScannerActive: (active) => ipcRenderer.invoke('scanner:set-active', active),

  onScan: (callback) => {
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on('scan', listener);
    return () => ipcRenderer.removeListener('scan', listener);
  },
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('status', listener);
    return () => ipcRenderer.removeListener('status', listener);
  },
  onScannerSet: (callback) => {
    const listener = (_event, active) => callback(active);
    ipcRenderer.on('scanner:set', listener);
    return () => ipcRenderer.removeListener('scanner:set', listener);
  },
});