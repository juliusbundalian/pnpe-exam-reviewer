import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeRoute from '../../src/app/index';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';

test.each(['Explore reviewers', 'Mock Exam', 'Progress', 'Saved Questions', 'Start Mock Exam'])(
  '%s explicitly reports development availability',
  (label) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(
      <ThemeProvider>
        <HomeRoute />
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByRole('button', { name: label }));
    expect(alert).toHaveBeenCalledWith(
      expect.stringContaining('development availability'),
      expect.stringContaining('not available'),
    );
    alert.mockRestore();
  },
);
