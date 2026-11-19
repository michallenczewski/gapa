// GapaSpacja — pomocnik Gapy na Windows: spacja w Eksploratorze otwiera podgląd zaznaczonego pliku w Gapie.
//
// Działa w tle jako proces potomny Gapy i rozmawia z nią przez stdin/stdout (po jednej linii JSON / polecenia):
//   → {"t":"space","path":"C:\\..."}   spacja w liście plików Eksploratora (path = zaznaczony plik)
//   → {"t":"esc"}                       Esc w Eksploratorze, gdy podgląd jest otwarty
//   → {"t":"sel","path":"C:\\..."}      zmiana zaznaczenia strzałkami, gdy podgląd jest otwarty
//   ← open 1 / open 0                   Gapa mówi, czy podgląd jest widoczny
//   ← pass                              Gapa nie obsługuje pliku — oddaj spację Eksploratorowi
//
// Spację przechwytujemy tylko wtedy, gdy na wierzchu jest okno Eksploratora, a fokus ma lista plików
// (nie pole nazwy, adresu ani wyszukiwania) i nie jest wciśnięty żaden modyfikator.
// Kompilacja (Windows, .NET Framework 4):
//   csc /target:winexe /optimize /r:Microsoft.CSharp.dll /r:System.Core.dll /out:GapaSpacja.exe GapaSpacja.cs

using System;
using System.Collections.Concurrent;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class GapaSpacja
{
    // ---------- WinAPI ----------
    delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int idHook, HookProc fn, IntPtr hMod, uint threadId);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll")] static extern int GetMessage(out MSG msg, IntPtr hwnd, uint min, uint max);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder sb, int max);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint threadId, ref GUITHREADINFO info);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
    [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
    [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(int pid);

    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public int x; public int y; }
    [StructLayout(LayoutKind.Sequential)] struct KBDLLHOOKSTRUCT { public uint vkCode; public uint scanCode; public uint flags; public uint time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int l, t, r, b; }
    [StructLayout(LayoutKind.Sequential)] struct GUITHREADINFO { public int cbSize; public uint flags; public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret; public RECT rcCaret; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public INPUTUNION u; }

    // aktywna karta Eksploratora w Windows 11: porównujemy okno przeglądarki karty z pierwszą ShellTabWindowClass
    [ComImport, Guid("6D5140C1-7436-11CE-8034-00AA006009FA"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IServiceProviderW { [PreserveSig] int QueryService(ref Guid sid, ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object obj); }
    [ComImport, Guid("000214E2-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellBrowserW { [PreserveSig] int GetWindow(out IntPtr hwnd); }
    static Guid SID_STopLevelBrowser = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");
    static Guid IID_IShellBrowser = new Guid("000214E2-0000-0000-C000-000000000046");

    const int WH_KEYBOARD_LL = 13;
    const uint VK_SPACE = 0x20, VK_ESCAPE = 0x1B;
    const uint LLKHF_INJECTED = 0x10;

    static HookProc hookProc;                       // trzymamy referencję, żeby GC nie zebrał delegata
    static volatile bool previewOpen = false;
    static volatile bool spaceHeld = false;         // spacja przechwycona i jeszcze nie puszczona
    static readonly BlockingCollection<string> jobs = new BlockingCollection<string>();
    static readonly object outLock = new object();

    [STAThread]
    static void Main()
    {
        var stdout = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
        stdout.AutoFlush = true;
        Console.SetOut(stdout);

        // polecenia od Gapy
        var reader = new Thread(() =>
        {
            var stdin = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
            string line;
            try
            {
                while ((line = stdin.ReadLine()) != null)
                {
                    line = line.Trim();
                    if (line == "open 1") previewOpen = true;
                    else if (line == "open 0") previewOpen = false;
                    else if (line == "pass") jobs.Add("pass");
                }
            }
            catch (Exception) { }
            Environment.Exit(0);                     // Gapa się zamknęła — kończymy razem z nią
        });
        reader.IsBackground = true;
        reader.Start();

        // odczyt zaznaczenia przez COM — osobny wątek STA, bo w samym haku nie wolno czekać
        var worker = new Thread(Worker);
        worker.IsBackground = true;
        worker.SetApartmentState(ApartmentState.STA);
        worker.Start();

        hookProc = Hook;
        SetWindowsHookEx(WH_KEYBOARD_LL, hookProc, GetModuleHandle(null), 0);
        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) { }
    }

    static string ClassOf(IntPtr h)
    {
        var sb = new StringBuilder(256);
        GetClassName(h, sb, sb.Capacity);
        return sb.ToString();
    }

    static bool Down(int vk) { return (GetAsyncKeyState(vk) & 0x8000) != 0; }
    static bool AnyModifier() { return Down(0x10) || Down(0x11) || Down(0x12) || Down(0x5B) || Down(0x5C); }

    // okno Eksploratora na wierzchu? (w fileList: czy fokus ma lista plików)
    static bool ExplorerFront(out IntPtr fg, out bool fileList)
    {
        fg = GetForegroundWindow();
        fileList = false;
        if (fg == IntPtr.Zero) return false;
        string cls = ClassOf(fg);
        if (cls != "CabinetWClass" && cls != "ExploreWClass") return false;
        uint pid;
        uint tid = GetWindowThreadProcessId(fg, out pid);
        var gti = new GUITHREADINFO();
        gti.cbSize = Marshal.SizeOf(typeof(GUITHREADINFO));
        if (GetGUIThreadInfo(tid, ref gti) && gti.hwndFocus != IntPtr.Zero)
            fileList = ClassOf(gti.hwndFocus) == "DirectUIHWND";
        return true;
    }

    static bool IsNavKey(uint vk)
    {
        return (vk >= 0x21 && vk <= 0x28);           // PageUp, PageDown, End, Home, strzałki
    }

    static IntPtr Hook(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var k = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            int msg = wParam.ToInt32();
            bool down = msg == 0x100 || msg == 0x104;
            bool up = msg == 0x101 || msg == 0x105;
            bool injected = (k.flags & LLKHF_INJECTED) != 0;

            if (!injected)
            {
                if (k.vkCode == VK_SPACE)
                {
                    if (up && spaceHeld) { spaceHeld = false; return (IntPtr)1; }
                    if (down && spaceHeld) return (IntPtr)1;                      // powtórzenia przy trzymaniu spacji
                    IntPtr fg; bool list;
                    if (down && !AnyModifier() && ExplorerFront(out fg, out list) && list)
                    {
                        spaceHeld = true;
                        jobs.Add("space|" + fg.ToInt64());
                        return (IntPtr)1;
                    }
                }
                else if (k.vkCode == VK_ESCAPE && previewOpen && down)
                {
                    IntPtr fg; bool list;
                    if (ExplorerFront(out fg, out list)) { jobs.Add("esc"); return (IntPtr)1; }
                }
                else if (previewOpen && up && IsNavKey(k.vkCode))
                {
                    IntPtr fg; bool list;
                    if (ExplorerFront(out fg, out list) && list) jobs.Add("sel|" + fg.ToInt64());
                }
            }
        }
        return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
    }

    static void Worker()
    {
        string lastSel = null;
        foreach (var job in jobs.GetConsumingEnumerable())
        {
            try
            {
                if (job == "pass") { Reinject(); continue; }
                if (job == "esc") { Send("{\"t\":\"esc\"}"); continue; }
                var parts = job.Split('|');
                IntPtr fg = new IntPtr(long.Parse(parts[1]));
                if (parts[0] == "space")
                {
                    string p = previewOpen ? null : FocusedPath(fg);
                    if (previewOpen) { Send("{\"t\":\"space\",\"path\":null}"); continue; }
                    if (p == null || !File.Exists(p)) { Reinject(); continue; }   // folder albo nic — spacja wraca do Eksploratora
                    lastSel = p;
                    AllowSetForegroundWindow(-1);
                    Send("{\"t\":\"space\",\"path\":" + Json(p) + "}");
                }
                else if (parts[0] == "sel")
                {
                    Thread.Sleep(30);                                              // Eksplorator musi zdążyć przesunąć zaznaczenie
                    string p = FocusedPath(fg);
                    if (p != null && p != lastSel && File.Exists(p)) { lastSel = p; Send("{\"t\":\"sel\",\"path\":" + Json(p) + "}"); }
                }
            }
            catch (Exception) { }
        }
    }

    // ścieżka pliku, który ma fokus w aktywnej karcie danego okna Eksploratora
    static string FocusedPath(IntPtr fg)
    {
        Type t = Type.GetTypeFromProgID("Shell.Application");
        dynamic shell = Activator.CreateInstance(t);
        dynamic windows = shell.Windows();
        IntPtr tab = FindWindowEx(fg, IntPtr.Zero, "ShellTabWindowClass", null);
        string single = null; int count = 0;
        foreach (dynamic w in windows)
        {
            try
            {
                if ((long)w.HWND != fg.ToInt64()) continue;
                count++;
                bool active = true;
                if (tab != IntPtr.Zero)
                {
                    active = false;
                    try
                    {
                        object o;
                        var sp = (IServiceProviderW)(object)w;
                        if (sp.QueryService(ref SID_STopLevelBrowser, ref IID_IShellBrowser, out o) == 0)
                        {
                            IntPtr bh;
                            if (((IShellBrowserW)o).GetWindow(out bh) == 0 && bh == tab) active = true;
                        }
                    }
                    catch (Exception) { }
                }
                dynamic item = w.Document.FocusedItem;
                if (item == null) continue;
                string path = (string)item.Path;
                if (active) return path;
                if (single == null) single = path;
            }
            catch (Exception) { }
        }
        return count == 1 ? single : null;
    }

    static void Reinject()
    {
        var inputs = new INPUT[2];
        inputs[0].type = 1; inputs[0].u.ki.wVk = (ushort)VK_SPACE;
        inputs[1].type = 1; inputs[1].u.ki.wVk = (ushort)VK_SPACE; inputs[1].u.ki.dwFlags = 2;   // KEYEVENTF_KEYUP
        SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static void Send(string line) { lock (outLock) { Console.Out.WriteLine(line); } }

    static string Json(string s)
    {
        var sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '\\') sb.Append("\\\\");
            else if (c == '"') sb.Append("\\\"");
            else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }
}
