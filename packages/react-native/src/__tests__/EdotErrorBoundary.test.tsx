import React from 'react';
import { Text } from 'react-native';
// @ts-expect-error -- react-test-renderer types not installed
import { create } from 'react-test-renderer';
import { EdotErrorBoundary } from '../components/EdotErrorBoundary';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
    reportJsException: jest.fn(),
  },
}));

function ThrowingComponent(): React.JSX.Element {
  throw new Error('render crash');
}

function GoodComponent(): React.JSX.Element {
  return <Text>Working</Text>;
}

describe('EdotErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when no error', () => {
    const tree = create(
      <EdotErrorBoundary fallback={<Text>Error</Text>}>
        <GoodComponent />
      </EdotErrorBoundary>,
    );

    expect(tree.toJSON()).toMatchObject({ children: ['Working'] });
  });

  it('renders fallback when child throws', () => {
    const tree = create(
      <EdotErrorBoundary fallback={<Text>Error occurred</Text>}>
        <ThrowingComponent />
      </EdotErrorBoundary>,
    );

    expect(tree.toJSON()).toMatchObject({ children: ['Error occurred'] });
  });

  it('reports error to native module', () => {
    const { EdotNativeModule } = require('../nativeModule');

    create(
      <EdotErrorBoundary fallback={<Text>Error</Text>}>
        <ThrowingComponent />
      </EdotErrorBoundary>,
    );

    expect(EdotNativeModule.startSpan).toHaveBeenCalledWith(
      'JS Error',
      expect.objectContaining({ 'error.source': 'js_render_error' }),
      null,
    );
  });
});
