import React, {
  createContext, useContext, useState, useCallback, useEffect, useMemo,
} from 'react';
import { CartService, Cart } from '../services/cart.service';

function cartCountFrom(cart: Cart): number {
  return cart.items?.length ?? 0;
}

interface CartActionsType {
  applyCart:        (cart: Cart) => void;
  refreshCartCount: () => Promise<void>;
}

const CartCountContext  = createContext(0);
const CartActionsContext = createContext<CartActionsType>({
  applyCart:        () => {},
  refreshCartCount: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0);

  const applyCart = useCallback((cart: Cart) => {
    setCartCount(cartCountFrom(cart));
  }, []);

  const refreshCartCount = useCallback(async () => {
    try {
      const cart = await CartService.getCart();
      applyCart(cart);
    } catch {}
  }, [applyCart]);

  const actions = useMemo(
    () => ({ applyCart, refreshCartCount }),
    [applyCart, refreshCartCount],
  );

  useEffect(() => { refreshCartCount(); }, [refreshCartCount]);

  return (
    <CartActionsContext.Provider value={actions}>
      <CartCountContext.Provider value={cartCount}>
        {children}
      </CartCountContext.Provider>
    </CartActionsContext.Provider>
  );
}

export const useCartCount = () => useContext(CartCountContext);

export const useCartActions = () => useContext(CartActionsContext);

export const useCart = () => ({
  cartCount:        useCartCount(),
  ...useCartActions(),
});
