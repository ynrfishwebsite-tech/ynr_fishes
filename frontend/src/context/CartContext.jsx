import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  return useContext(CartContext);
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load from local storage
  useEffect(() => {
    const savedCart = localStorage.getItem('ynr_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('ynr_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product, quantity = 1) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.title === product.title);
      if (existing) {
        return prev.map(item => 
          item.title === product.title 
            ? { ...item, quantity: (item.quantity || 1) + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productTitle) => {
    setCartItems(prev => prev.filter(item => item.title !== productTitle));
  };

  const updateQuantity = (productTitle, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productTitle);
      return;
    }
    setCartItems(prev => 
      prev.map(item => 
        item.title === productTitle 
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  const cartTotal = safeCartItems.reduce((total, item) => total + ((item.price || 0) * (item.quantity || 1)), 0);
  const cartCount = safeCartItems.reduce((count, item) => count + (item.quantity || 1), 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartCount,
      isCartOpen,
      setIsCartOpen
    }}>
      {children}
    </CartContext.Provider>
  );
};
