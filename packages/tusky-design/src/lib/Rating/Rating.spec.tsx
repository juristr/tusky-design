import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Rating } from './Rating';

describe('Rating', () => {
  describe('onCountClick', () => {
    it('renders button when onCountClick provided', () => {
      const handleClick = vi.fn();
      render(
        <Rating value={4} showCount count={100} onCountClick={handleClick} />
      );
      const countElement = screen.getByTestId('rating-count');
      expect(countElement.tagName).toBe('BUTTON');
    });

    it('renders span when onCountClick not provided', () => {
      render(<Rating value={4} showCount count={100} />);
      const countElement = screen.getByTestId('rating-count');
      expect(countElement.tagName).toBe('SPAN');
    });

    it('calls onCountClick when clicked', () => {
      const handleClick = vi.fn();
      render(
        <Rating value={4} showCount count={100} onCountClick={handleClick} />
      );
      fireEvent.click(screen.getByTestId('rating-count'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
