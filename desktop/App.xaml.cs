using System.IO;
using System.Threading;
using System.Windows;

using MemoVaultNote.Services;

namespace MemoVaultNote;

public partial class App : Application
{
    private Mutex? _mutex;
    private NoteManager? _manager;

    protected override void OnStartup(StartupEventArgs e)
    {
        // 崩了至少留个现场：写 %TEMP%，不打扰用户也不依赖安装目录权限
        DispatcherUnhandledException += (_, args) => LogCrash(args.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, args) => LogCrash(args.ExceptionObject as Exception);

        // 便签类工具重复启动会很烦：第二个实例直接退出，交给已有窗口
        _mutex = new Mutex(true, @"Local\MemoVaultNote.SingleInstance", out var createdNew);
        if (!createdNew)
        {
            Shutdown();
            return;
        }

        base.OnStartup(e);

        // 窗口可能全部关掉（虽然正常路径不会），生命周期由 NoteManager 控制
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        try
        {
            _manager = new NoteManager();
            _manager.Start();
        }
        catch (Exception ex)
        {
            LogCrash(ex);
            MessageBox.Show("启动失败：" + ex.Message, "MemoVault 便签", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(1);
        }
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _mutex?.Dispose();
        base.OnExit(e);
    }

    private static void LogCrash(Exception? ex)
    {
        if (ex is null) return;

        try
        {
            var path = Path.Combine(Path.GetTempPath(), "MemoVaultNote-crash.log");
            File.AppendAllText(path, $"[{DateTime.Now:O}] {ex}{Environment.NewLine}{Environment.NewLine}");
        }
        catch
        {
            /* 记不下来就算了 */
        }
    }
}
