// Hermes's native URL implementation exposes `username` and `password` as
// getter-only properties after expo-modules-core's JSI interop is installed.
// @expo/metro-runtime's Location.native.js sets these to '' in its constructor,
// which throws in strict mode. Add no-op setters to allow the assignment.
if (typeof URL !== 'undefined' && URL.prototype) {
  ['username', 'password'].forEach(function (prop) {
    const desc = Object.getOwnPropertyDescriptor(URL.prototype, prop);
    if (desc && desc.get && !desc.set) {
      Object.defineProperty(URL.prototype, prop, {
        get: desc.get,
        set: function () {},
        configurable: true,
        enumerable: true,
      });
    }
  });
}
