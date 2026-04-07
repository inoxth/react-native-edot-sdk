describe('detectResourceAttributes', () => {
  beforeEach(() => {
    jest.resetModules();

    delete global.HermesInternal;

    delete global.nativeFabricUIManager;
  });

  it('detects Hermes when HermesInternal is present', () => {
    global.HermesInternal = {};

    const { detectResourceAttributes } = require('../resource');
    const attrs = detectResourceAttributes();
    expect(attrs['rn.hermes']).toBe(true);
  });

  it('detects non-Hermes when HermesInternal is absent', () => {
    const { detectResourceAttributes } = require('../resource');
    const attrs = detectResourceAttributes();
    expect(attrs['rn.hermes']).toBe(false);
  });

  it('detects Fabric architecture when nativeFabricUIManager is present', () => {
    global.nativeFabricUIManager = {};

    const { detectResourceAttributes } = require('../resource');
    const attrs = detectResourceAttributes();
    expect(attrs['rn.architecture']).toBe('fabric');
  });

  it('detects Bridge architecture when nativeFabricUIManager is absent', () => {
    const { detectResourceAttributes } = require('../resource');
    const attrs = detectResourceAttributes();
    expect(attrs['rn.architecture']).toBe('bridge');
  });

  it('includes SDK metadata', () => {
    const { detectResourceAttributes } = require('../resource');
    const attrs = detectResourceAttributes();
    expect(attrs['telemetry.sdk.name']).toBe('edot-react-native');
    expect(attrs['telemetry.sdk.language']).toBe('javascript');
    expect(attrs['telemetry.sdk.version']).toBeDefined();
  });

  it('includes OS type', () => {
    const { detectResourceAttributes } = require('../resource');
    const attrs = detectResourceAttributes();
    expect(attrs['os.type']).toBeDefined();
  });
});
