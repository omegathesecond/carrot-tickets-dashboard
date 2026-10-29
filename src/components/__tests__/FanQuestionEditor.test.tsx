// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FanQuestionEditor } from '../FanQuestionEditor';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
vi.mock('@/lib/api', () => ({ apiClient: { vote: { saveQuestions: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup() {
  render(<QueryClientProvider client={new QueryClient()}><FanQuestionEditor eventId="event" settings={[
    { kind: 'busy', prompt: 'How busy?', enabled: true, options: [{ key: 'yes', label: 'Busy' }, { key: 'no', label: 'Quiet' }] },
  ]} /></QueryClientProvider>);
}
it('edits defaults, hides them, adds a custom question and saves the complete selection', async () => {
  vi.mocked(apiClient.vote.saveQuestions).mockResolvedValue({ settings: [], questions: [], eventId: 'event', window: { opensAt: null, closesAt: '', hasOpened: false, hasClosed: false } });
  setup();
  fireEvent.change(screen.getByLabelText('Question 1'), { target: { value: 'Will it be busy?' } });
  fireEvent.click(screen.getByLabelText('Show to fans'));
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
  fireEvent.change(screen.getByLabelText('Question 2'), { target: { value: 'Travel?' } });
  const answers = screen.getAllByLabelText('Answer 1');
  fireEvent.change(answers[1]!, { target: { value: 'Bus' } });
  fireEvent.change(screen.getAllByLabelText('Answer 2')[1]!, { target: { value: 'Car' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save questions' }));
  await waitFor(() => expect(apiClient.vote.saveQuestions).toHaveBeenCalledWith('event', [
    expect.objectContaining({ kind: 'busy', prompt: 'Will it be busy?', enabled: false }),
    expect.objectContaining({ kind: expect.stringMatching(/^custom_/), prompt: 'Travel?', enabled: true, options: [expect.objectContaining({ label: 'Bus' }), expect.objectContaining({ label: 'Car' })] }),
  ]));
});
it('can delete every question, saves an empty list, and surfaces save errors', async () => {
  vi.mocked(apiClient.vote.saveQuestions).mockRejectedValue(new Error('Save failed'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Delete question 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save questions' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Save failed'));
  expect(apiClient.vote.saveQuestions).toHaveBeenCalledWith('event', []);
});
