package com.rookwise.review;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Vibrator;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.kalab.chess.enginesupport.ChessEngine;
import com.kalab.chess.enginesupport.ChessEngineResolver;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Runs UCI engines as native processes and imports engine files (picked files or OEX apps). */
@CapacitorPlugin(name = "EngineHost")
public class EngineHostPlugin extends Plugin {
    private final Map<String, Process> procs = new ConcurrentHashMap<>();

    private File dir(String sub) {
        File d = new File(getContext().getFilesDir(), "engines/" + sub);
        d.mkdirs();
        return d;
    }

    private String nameOf(Uri u) {
        String name = null;
        try (Cursor c = getContext().getContentResolver().query(u, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0) name = c.getString(i);
            }
        } catch (Exception ignored) { }
        if (name == null || name.isEmpty()) name = "file" + System.currentTimeMillis();
        return name.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    @PluginMethod
    public void pickFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(call, i, "pickDone");
    }

    @ActivityCallback
    private void pickDone(PluginCall call, ActivityResult r) {
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        final Uri u = r.getData().getData();
        final boolean exe = "engine".equals(call.getString("kind"));
        new Thread(() -> {
            try {
                String name = nameOf(u);
                File out = new File(dir(exe ? "bin" : "files"), name);
                try (InputStream in = getContext().getContentResolver().openInputStream(u);
                     FileOutputStream fo = new FileOutputStream(out)) {
                    byte[] b = new byte[65536];
                    int n;
                    while ((n = in.read(b)) != -1) fo.write(b, 0, n);
                }
                if (exe) out.setExecutable(true, false);
                JSObject o = new JSObject();
                o.put("name", name);
                o.put("path", out.getAbsolutePath());
                call.resolve(o);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void listOex(PluginCall call) {
        JSArray arr = new JSArray();
        try {
            List<ChessEngine> l = new ChessEngineResolver(getContext()).resolveEngines();
            for (ChessEngine e : l) {
                JSObject o = new JSObject();
                o.put("name", e.getName());
                o.put("file", e.getFileName());
                o.put("pkg", e.getPackageName());
                arr.put(o);
            }
        } catch (Exception ignored) { }
        JSObject r = new JSObject();
        r.put("engines", arr);
        call.resolve(r);
    }

    @PluginMethod
    public void importOex(PluginCall call) {
        final String file = call.getString("file");
        final String pkg = call.getString("pkg");
        new Thread(() -> {
            try {
                for (ChessEngine e : new ChessEngineResolver(getContext()).resolveEngines()) {
                    if (e.getFileName().equals(file) && e.getPackageName().equals(pkg)) {
                        File f = e.copyToFiles(getContext().getContentResolver(), dir("oex"));
                        JSObject o = new JSObject();
                        o.put("name", e.getName());
                        o.put("path", f.getAbsolutePath());
                        call.resolve(o);
                        return;
                    }
                }
                call.reject("Engine not found");
            } catch (Exception ex) {
                call.reject(String.valueOf(ex.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void start(PluginCall call) {
        final String id = call.getString("id");
        final String path = call.getString("path");
        JSArray args = call.getArray("args");
        try {
            List<String> cmd = new ArrayList<>();
            cmd.add(path);
            if (args != null) for (int i = 0; i < args.length(); i++) cmd.add(args.getString(i));
            File f = new File(path);
            f.setExecutable(true, false);
            final Process p = new ProcessBuilder(cmd).directory(f.getParentFile()).start();
            procs.put(id, p);
            new Thread(() -> {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String l;
                    while ((l = r.readLine()) != null) {
                        JSObject o = new JSObject();
                        o.put("id", id);
                        o.put("line", l);
                        notifyListeners("line", o);
                    }
                } catch (Exception ignored) { }
                JSObject o = new JSObject();
                o.put("id", id);
                notifyListeners("exit", o);
            }).start();
            new Thread(() -> {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getErrorStream()))) {
                    while (r.readLine() != null) { }
                } catch (Exception ignored) { }
            }).start();
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start engine: " + e.getMessage());
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        Process p = procs.get(call.getString("id"));
        if (p == null) {
            call.reject("Engine is not running");
            return;
        }
        try {
            OutputStream o = p.getOutputStream();
            o.write((call.getString("cmd") + "\n").getBytes("UTF-8"));
            o.flush();
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Process p = procs.remove(call.getString("id"));
        if (p != null) p.destroy();
        call.resolve();
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String path = call.getString("path");
        if (path != null && path.startsWith(new File(getContext().getFilesDir(), "engines").getAbsolutePath())) {
            new File(path).delete();
        }
        call.resolve();
    }

    @PluginMethod
    public void haptic(PluginCall call) {
        try {
            Vibrator v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate((long) call.getInt("ms", 15));
        } catch (Exception ignored) { }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        for (Process p : procs.values()) p.destroy();
        procs.clear();
    }
}
