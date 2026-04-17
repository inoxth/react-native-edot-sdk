import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
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
    render(
      <EdotErrorBoundary fallback={<Text>Error</Text>}>
        <GoodComponent />
      </EdotErrorBoundary>,
    );

    expect(screen.getByText('Working')).toBeTruthy();
  });

  it('renders fallback when child throws', () => {
    render(
      <EdotErrorBoundary fallback={<Text>Error occurred</Text>}>
        <ThrowingComponent />
      </EdotErrorBoundary>,
    );

    expect(screen.getByText('Error occurred')).toBeTruthy();
  });

  it('reports error to native module', () => {
    const { EdotNativeModule } = require('../nativeModule');

    render(
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
