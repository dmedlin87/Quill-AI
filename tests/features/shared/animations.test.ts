import { describe, it, expect } from 'vitest';
import { 
  fadeVariants, 
  slideUpVariants, 
  panelSlideVariants, 
  dialogZoomVariants,
  springTransition 
} from '@/features/shared/animations';

describe('animations', () => {
  describe('fadeVariants', () => {
    it('has hidden state with opacity 0', () => {
      expect(fadeVariants.hidden).toEqual({ opacity: 0 });
    });

    it('has visible state with opacity 1', () => {
      expect(fadeVariants.visible).toMatchObject({ opacity: 1 });
    });

    it('has exit state', () => {
      expect(fadeVariants.exit).toMatchObject({ opacity: 0 });
    });
  });

  describe('slideUpVariants', () => {
    it('has hidden state with y offset', () => {
      expect(slideUpVariants.hidden).toMatchObject({ opacity: 0, y: 20 });
    });

    it('has visible state at y: 0', () => {
      expect(slideUpVariants.visible).toMatchObject({ opacity: 1, y: 0 });
    });

    it('uses spring transition type', () => {
      const visible = slideUpVariants.visible as any;
      expect(visible.transition?.type).toBe('spring');
    });

    it('has exit state with y offset', () => {
      expect(slideUpVariants.exit).toMatchObject({ y: 20 });
    });
  });

  describe('panelSlideVariants', () => {
    it('has hidden state offscreen to the right', () => {
      expect(panelSlideVariants.hidden).toMatchObject({ x: '100%', opacity: 0 });
    });

    it('has visible state at x: 0', () => {
      expect(panelSlideVariants.visible).toMatchObject({ x: 0, opacity: 1 });
    });

    it('uses spring transition type', () => {
      const visible = panelSlideVariants.visible as any;
      expect(visible.transition?.type).toBe('spring');
    });

    it('has exit state sliding to the right', () => {
      expect(panelSlideVariants.exit).toMatchObject({ x: '100%' });
    });
  });

  describe('dialogZoomVariants', () => {
    it('has hidden state with scale < 1', () => {
      expect(dialogZoomVariants.hidden).toMatchObject({ 
        opacity: 0, 
        scale: 0.95, 
        y: -10 
      });
    });

    it('has visible state at scale 1', () => {
      expect(dialogZoomVariants.visible).toMatchObject({ 
        opacity: 1, 
        scale: 1, 
        y: 0 
      });
    });

    it('uses spring transition type', () => {
      const visible = dialogZoomVariants.visible as any;
      expect(visible.transition?.type).toBe('spring');
    });

    it('has exit state with slight scale down', () => {
      expect(dialogZoomVariants.exit).toMatchObject({ 
        opacity: 0, 
        scale: 0.95 
      });
    });
  });

  describe('springTransition', () => {
    it('has spring type', () => {
      expect(springTransition.type).toBe('spring');
    });

    it('has stiffness value', () => {
      expect(springTransition.stiffness).toBe(400);
    });

    it('has damping value', () => {
      expect(springTransition.damping).toBe(30);
    });
  });
});
