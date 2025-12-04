import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within, userEvent } from 'storybook/test';
import { Rating } from './Rating';

const meta = {
  title: 'Atoms/Rating',
  component: Rating,
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 5, step: 0.5 } },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiveStars: Story = {
  args: { value: 5 },
};

export const FourStars: Story = {
  args: { value: 4 },
};

export const ThreeStars: Story = {
  args: { value: 3 },
};

export const WithCount: Story = {
  args: { value: 4.5, showCount: true, count: 128 },
};

export const Small: Story = {
  args: { value: 4, size: 'sm' },
};

export const Large: Story = {
  args: { value: 4, size: 'lg' },
};

export const ZeroStars: Story = {
  args: { value: 0 },
};

export const StarRenderTest: Story = {
  args: { value: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filledStars = canvas.getAllByTestId('star-filled');
    const emptyStars = canvas.getAllByTestId('star-empty');
    await expect(filledStars).toHaveLength(3);
    await expect(emptyStars).toHaveLength(2);
  },
};

export const HalfStarRenderTest: Story = {
  args: { value: 3.5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filledStars = canvas.getAllByTestId('star-filled');
    const halfStars = canvas.getAllByTestId('star-half');
    const emptyStars = canvas.getAllByTestId('star-empty');
    await expect(filledStars).toHaveLength(3);
    await expect(halfStars).toHaveLength(1);
    await expect(emptyStars).toHaveLength(1);
  },
};

export const FourAndHalfStarsTest: Story = {
  args: { value: 4.5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filledStars = canvas.getAllByTestId('star-filled');
    const halfStars = canvas.getAllByTestId('star-half');
    await expect(filledStars).toHaveLength(4);
    await expect(halfStars).toHaveLength(1);
    await expect(canvas.queryAllByTestId('star-empty')).toHaveLength(0);
  },
};

export const HalfStarOnlyTest: Story = {
  args: { value: 0.5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const halfStars = canvas.getAllByTestId('star-half');
    const emptyStars = canvas.getAllByTestId('star-empty');
    await expect(canvas.queryAllByTestId('star-filled')).toHaveLength(0);
    await expect(halfStars).toHaveLength(1);
    await expect(emptyStars).toHaveLength(4);
  },
};

export const WithClickableCount: Story = {
  args: {
    value: 4.5,
    showCount: true,
    count: 128,
    onCountClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const countButton = canvas.getByTestId('rating-count');
    await expect(countButton.tagName).toBe('BUTTON');
    await userEvent.click(countButton);
    await expect(args.onCountClick).toHaveBeenCalled();
  },
};
