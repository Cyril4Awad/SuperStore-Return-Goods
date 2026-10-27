package com.portablepos;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import java.io.File;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.config.ReactFeatureFlags;
import com.facebook.soloader.SoLoader;
import com.portablepos.newarchitecture.MainApplicationReactNativeHost;
import java.lang.reflect.InvocationTargetException;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost =
      new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // packages.add(new MyReactNativePackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }
      };

  private final ReactNativeHost mNewArchitectureNativeHost =
      new MainApplicationReactNativeHost(this);

  @Override
  public ReactNativeHost getReactNativeHost() {
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      return mNewArchitectureNativeHost;
    } else {
      return mReactNativeHost;
    }
  }

  // The images of the app are cached on disk by the image library (Fresco) under their resource number.
  // Adding an image to the app renumbers the images, so after an update the old cache showed the wrong
  // images (login background, logo, icons). The image caches are cleared once after each install / update,
  // before the image library starts. Only the image caches : the data of the app is not touched.
  private void clearImageCacheAfterUpdate() {
    try {
      long lastUpdateTime = getPackageManager().getPackageInfo(getPackageName(), 0).lastUpdateTime;
      SharedPreferences preferences = getSharedPreferences("app_image_cache", MODE_PRIVATE);
      if (preferences.getLong("lastUpdateTime", 0) == lastUpdateTime) {
        return;
      }
      File[] folders = getCacheDir().listFiles();
      if (folders != null) {
        for (File folder : folders) {
          if (folder.isDirectory() && folder.getName().startsWith("image")) {
            deleteRecursive(folder);
          }
        }
      }
      preferences.edit().putLong("lastUpdateTime", lastUpdateTime).apply();
    } catch (Exception e) {
      // never block the start of the app
    }
  }

  private static void deleteRecursive(File file) {
    File[] children = file.listFiles();
    if (children != null) {
      for (File child : children) {
        deleteRecursive(child);
      }
    }
    file.delete();
  }

  @Override
  public void onCreate() {
    super.onCreate();
    clearImageCacheAfterUpdate();
    // If you opted-in for the New Architecture, we enable the TurboModule system
    ReactFeatureFlags.useTurboModules = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
    SoLoader.init(this, /* native exopackage */ false);
    initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
  }

  /**
   * Loads Flipper in React Native templates. Call this in the onCreate method with something like
   * initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
   *
   * @param context
   * @param reactInstanceManager
   */
  private static void initializeFlipper(
      Context context, ReactInstanceManager reactInstanceManager) {
    if (BuildConfig.DEBUG) {
      try {
        /*
         We use reflection here to pick up the class that initializes Flipper,
        since Flipper library is not available in release mode
        */
        Class<?> aClass = Class.forName("com.portablepos.ReactNativeFlipper");
        aClass
            .getMethod("initializeFlipper", Context.class, ReactInstanceManager.class)
            .invoke(null, context, reactInstanceManager);
      } catch (ClassNotFoundException e) {
        e.printStackTrace();
      } catch (NoSuchMethodException e) {
        e.printStackTrace();
      } catch (IllegalAccessException e) {
        e.printStackTrace();
      } catch (InvocationTargetException e) {
        e.printStackTrace();
      }
    }
  }
}
