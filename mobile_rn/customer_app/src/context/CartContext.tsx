import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CartService } from '../services/cart.service';

interface CartContextType {
  cartCount:        number;
  refreshCartCount: () => Promise<void>;
}

const CartContext = createContext<CartContextType>({
  cartCount:        0,
  refreshCartCount: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    try {
      const cart = await CartService.getCart();
      setCartCount(cart.items?.length ?? 0);
    } catch {}
  }, []);

  useEffect(() => { refreshCartCount(); }, []);

  return (
    <CartContext.Provider value={{ cartCount, refreshCartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
