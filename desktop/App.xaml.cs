using System.Threading;
using System.Windows;

namespace MemoVaultNote;

public partial class App : Application
{
    private Mutex? _mutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        // 便签类工具重复启动会很烦：第二个实例直接退出，交给已有窗口
        _mutex = new Mutex(true, @"Local\MemoVaultNote.SingleInstance", out var createdNew);
        if (!createdNew)
        {
            Shutdown();
            return;
        }

        base.OnStartup(e);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _mutex?.Dispose();
        base.OnExit(e);
    }
}
