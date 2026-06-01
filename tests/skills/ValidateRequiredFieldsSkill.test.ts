import { describe, it, expect } from 'vitest';
import { ValidateRequiredFieldsSkill } from '../../skills/ValidateRequiredFieldsSkill';

describe('ValidateRequiredFieldsSkill', () => {
  const skill = new ValidateRequiredFieldsSkill();

  describe('canHandle', () => {
    it('returns true for validate_required_fields', () => {
      expect(skill.canHandle('validate_required_fields')).toBe(true);
    });

    it('returns false for other action types', () => {
      expect(skill.canHandle('send_message')).toBe(false);
      expect(skill.canHandle('none')).toBe(false);
      expect(skill.canHandle('')).toBe(false);
    });
  });

  describe('execute — payload validation errors', () => {
    it('returns success false if input is not an object', async () => {
      const result = await skill.execute('string');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('returns success false if input is null', async () => {
      const result = await skill.execute(null);
      expect(result.success).toBe(false);
    });

    it('returns success false if input is an array', async () => {
      const result = await skill.execute([]);
      expect(result.success).toBe(false);
    });

    it('returns success false if fields is missing', async () => {
      const result = await skill.execute({ required: ['a'] });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/fields/i);
    });

    it('returns success false if fields is an array', async () => {
      const result = await skill.execute({ fields: ['a', 'b'], required: ['a'] });
      expect(result.success).toBe(false);
    });

    it('returns success false if fields is null', async () => {
      const result = await skill.execute({ fields: null, required: ['a'] });
      expect(result.success).toBe(false);
    });

    it('returns success false if required is missing', async () => {
      const result = await skill.execute({ fields: { a: 1 } });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it('returns success false if required is not an array', async () => {
      const result = await skill.execute({ fields: { a: 1 }, required: 'a' });
      expect(result.success).toBe(false);
    });

    it('returns success false if required contains non-strings', async () => {
      const result = await skill.execute({ fields: { a: 1 }, required: [1, 2] });
      expect(result.success).toBe(false);
    });
  });

  describe('execute — validation logic', () => {
    it('returns valid true and missing [] when all required fields are present', async () => {
      const result = await skill.execute({
        fields: { name: 'Alice', email: 'alice@example.com' },
        required: ['name', 'email']
      });
      expect(result.success).toBe(true);
      expect(result.data?.['valid']).toBe(true);
      expect(result.data?.['missing']).toEqual([]);
      expect(result.message).toBe('Required fields validation completed.');
    });

    it('returns valid false and lists missing fields when some are absent', async () => {
      const result = await skill.execute({
        fields: { name: 'Alice' },
        required: ['name', 'email', 'phone']
      });
      expect(result.success).toBe(true);
      expect(result.data?.['valid']).toBe(false);
      expect(result.data?.['missing']).toEqual(['email', 'phone']);
    });

    it('returns valid true and missing [] when required is empty', async () => {
      const result = await skill.execute({
        fields: { name: 'Alice' },
        required: []
      });
      expect(result.success).toBe(true);
      expect(result.data?.['valid']).toBe(true);
      expect(result.data?.['missing']).toEqual([]);
    });

    it('counts empty string as missing', async () => {
      const result = await skill.execute({
        fields: { name: '' },
        required: ['name']
      });
      expect(result.data?.['valid']).toBe(false);
      expect(result.data?.['missing']).toContain('name');
    });

    it('counts whitespace-only string as missing', async () => {
      const result = await skill.execute({
        fields: { name: '   ' },
        required: ['name']
      });
      expect(result.data?.['valid']).toBe(false);
      expect(result.data?.['missing']).toContain('name');
    });

    it('counts null as missing', async () => {
      const result = await skill.execute({
        fields: { name: null },
        required: ['name']
      });
      expect(result.data?.['valid']).toBe(false);
      expect(result.data?.['missing']).toContain('name');
    });

    it('counts undefined as missing', async () => {
      const result = await skill.execute({
        fields: { name: undefined },
        required: ['name']
      });
      expect(result.data?.['valid']).toBe(false);
      expect(result.data?.['missing']).toContain('name');
    });

    it('counts 0 as present', async () => {
      const result = await skill.execute({
        fields: { count: 0 },
        required: ['count']
      });
      expect(result.data?.['valid']).toBe(true);
      expect(result.data?.['missing']).toEqual([]);
    });

    it('counts false as present', async () => {
      const result = await skill.execute({
        fields: { active: false },
        required: ['active']
      });
      expect(result.data?.['valid']).toBe(true);
      expect(result.data?.['missing']).toEqual([]);
    });

    it('counts empty array [] as present', async () => {
      const result = await skill.execute({
        fields: { items: [] },
        required: ['items']
      });
      expect(result.data?.['valid']).toBe(true);
      expect(result.data?.['missing']).toEqual([]);
    });

    it('counts a field entirely absent from fields as missing', async () => {
      const result = await skill.execute({
        fields: {},
        required: ['name']
      });
      expect(result.data?.['valid']).toBe(false);
      expect(result.data?.['missing']).toContain('name');
    });
  });
});
