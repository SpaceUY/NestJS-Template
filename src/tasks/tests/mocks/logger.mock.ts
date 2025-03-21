export class MockLogger {
  public setContext = jest.fn();
  public debug = jest.fn();
  public info = jest.fn();
  public warn = jest.fn();
  public error = jest.fn();
}
