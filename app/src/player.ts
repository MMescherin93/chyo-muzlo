import { Capacitor } from '@capacitor/core';
import { BackgroundColor, InAppBrowser, ToolBarType } from '@capgo/inappbrowser';

/** true только в нативном APK (не в браузере). */
export const isNativeApp = Capacitor.isNativePlatform();

let opened = false;

/**
 * Открывает плеер Яндекс Музыки во встроенном WebView поверх приложения.
 * Логин в Яндексе сохраняется (cookies WebView), поэтому вводить его нужно один раз.
 */
export async function openPlayer(url: string): Promise<void> {
  if (!isNativeApp) return;
  try {
    await InAppBrowser.openWebView({
      url,
      title: 'Яндекс Музыка',
      toolbarType: ToolBarType.ACTIVITY,
      backgroundColor: BackgroundColor.BLACK,
      isPresentAfterPageLoad: false,
    });
    opened = true;
  } catch (e) {
    console.error('openPlayer', e);
  }
}

export async function closePlayer(): Promise<void> {
  if (!isNativeApp || !opened) return;
  opened = false;
  try {
    await InAppBrowser.close();
  } catch {
    /* уже закрыт */
  }
}
