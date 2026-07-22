import React from 'react';
import { act } from 'react-test-renderer';
import renderer from 'react-test-renderer';

jest.mock('expo-router', () => {
  const pushMock = jest.fn();
  return {
    useLocalSearchParams: () => ({ id: 'CMD-1001' }),
    useRouter: () => ({ push: pushMock, back: jest.fn() }),
    __esModule: true,
    pushMock,
  };
});

const { pushMock } = require('expo-router');

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Text', props, null),
  };
});

jest.mock('../api/client', () => ({
  get: jest.fn(),
  patch: jest.fn(),
}));

const apiClient = require('../api/client');
const OrderPrepareScreen = require('../app/main/order_prepare').default;

const MOCK_ORDER = {
  id: 'CMD-1001',
  reference: '#1001',
  customerName: 'Youssef',
  status: 'preparing',
  items: [
    {
      id: '1',
      productName: 'Sandwich Poulet',
      quantity: 2,
      unit: 'unit',
      collected: true,
    },
  ],
};

describe('OrderPrepareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders order and navigates to placement when all items collected', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: MOCK_ORDER });

    let tree: any;

    await act(async () => {
      tree = renderer.create(<OrderPrepareScreen />);
      // allow effects and promises to resolve
      await Promise.resolve();
    });

    const getTextContent = (node: any): string => {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map((n) => getTextContent(n)).join('');
      if (node.children) return node.children.map((c: any) => getTextContent(c)).join('');
      return '';
    };

    console.log('TREE_JSON', JSON.stringify(tree.toJSON(), null, 2));
    const allText = getTextContent(tree.toJSON());
    console.log('ALL_TEXT', allText);
    expect(allText.includes('Youssef - #1001')).toBe(true);

    // find and press the submit button
    const root = tree.root;
    const submitButton = root.findAll((n: any) => n.props && typeof n.props.onPress === 'function' && getTextContent(n.children).includes('Commande Préparer'))[0];
    expect(submitButton).toBeDefined();

    await act(async () => {
      submitButton.props.onPress();
      await Promise.resolve();
    });

    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/main/order_placement',
      params: { id: 'CMD-1001' },
    });
  });
});
