// Vibración táctil — solo en dispositivos con soporte
// 10ms al agregar producto, 30ms al cobrar, 5ms al remover

const supported = typeof navigator !== 'undefined' && 'vibrate' in navigator

export const haptics = {
  add():     void { if (supported) navigator.vibrate(10) },
  confirm(): void { if (supported) navigator.vibrate([30, 10, 30]) },
  remove():  void { if (supported) navigator.vibrate(5) },
  error():   void { if (supported) navigator.vibrate([50, 30, 50]) },
}
