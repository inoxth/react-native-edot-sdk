import React from 'react';
import { Pressable, Text } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { withEdotTracking } from '../interactions/with-edot-tracking';
import { useEdotAction } from '../interactions/use-edot-action';
import { ActiveViewContext } from '../activeViewContext';
import { EdotNativeModule } from '../nativeModule';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    emitLog: jest.fn(),
  },
}));

interface ButtonProps {
  onPress?: (...args: unknown[]) => void;
  title?: string;
}

function MockButton(props: ButtonProps): React.ReactElement {
  return (
    <Pressable onPress={props.onPress} testID="mock-button">
      <Text>{props.title}</Text>
    </Pressable>
  );
}
MockButton.displayName = 'MockButton';

describe('withEdotTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ActiveViewContext._resetForTesting();
  });

  it('calls addAction on press', () => {
    const TrackedButton = withEdotTracking(MockButton);
    const onPress = jest.fn();

    const { getByTestId } = render(
      <TrackedButton onPress={onPress} title="Add" />,
    );

    fireEvent.press(getByTestId('mock-button'));

    expect(EdotNativeModule.emitLog).toHaveBeenCalledWith(
      'info',
      'UserAction: MockButton',
      expect.objectContaining({
        'user_action.type': 'tap',
        'user_action.target': 'MockButton',
      }),
    );
    expect(onPress).toHaveBeenCalled();
  });

  it('uses custom action name', () => {
    const TrackedButton = withEdotTracking(MockButton, 'checkout.confirm');

    const { getByTestId } = render(
      <TrackedButton title="Confirm" />,
    );

    fireEvent.press(getByTestId('mock-button'));

    expect(EdotNativeModule.emitLog).toHaveBeenCalledWith(
      'info',
      'UserAction: checkout.confirm',
      expect.objectContaining({ 'user_action.target': 'checkout.confirm' }),
    );
  });

  it('includes view.name from active view', () => {
    ActiveViewContext.setActiveView({ name: 'CartScreen', spanId: 'span-1' });
    const TrackedButton = withEdotTracking(MockButton);

    const { getByTestId } = render(
      <TrackedButton title="Add" />,
    );

    fireEvent.press(getByTestId('mock-button'));

    expect(EdotNativeModule.emitLog).toHaveBeenCalledWith(
      'info',
      expect.any(String),
      expect.objectContaining({ 'view.name': 'CartScreen' }),
    );
  });
});

describe('useEdotAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ActiveViewContext._resetForTesting();
  });

  function TestComponent({ onReady }: { onReady: (api: ReturnType<typeof useEdotAction>) => void }): React.ReactElement {
    const api = useEdotAction();
    React.useEffect(() => { onReady(api); }, []);
    return React.createElement(Text, null, 'test');
  }

  it('tracks action with attributes', () => {
    let api: ReturnType<typeof useEdotAction> | undefined;
    render(
      <TestComponent onReady={(a) => { api = a; }} />,
    );

    act(() => {
      api?.trackAction('swipe', 'dismiss_card', { 'card.id': '42' });
    });

    expect(EdotNativeModule.emitLog).toHaveBeenCalledWith(
      'info',
      'UserAction: dismiss_card',
      expect.objectContaining({
        'user_action.type': 'swipe',
        'user_action.target': 'dismiss_card',
        'card.id': '42',
      }),
    );
  });

  it('includes view.name when active view exists', () => {
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });

    let api: ReturnType<typeof useEdotAction> | undefined;
    render(
      <TestComponent onReady={(a) => { api = a; }} />,
    );

    act(() => {
      api?.trackAction('tap', 'login');
    });

    expect(EdotNativeModule.emitLog).toHaveBeenCalledWith(
      'info',
      'UserAction: login',
      expect.objectContaining({ 'view.name': 'HomeScreen' }),
    );
  });

  it('works without active view', () => {
    let api: ReturnType<typeof useEdotAction> | undefined;
    render(
      <TestComponent onReady={(a) => { api = a; }} />,
    );

    act(() => {
      api?.trackAction('tap', 'login');
    });

    const callArgs = (EdotNativeModule.emitLog as jest.Mock).mock.calls[0][2];
    expect(callArgs['view.name']).toBeUndefined();
  });
});
