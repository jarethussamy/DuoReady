import SwiftUI

struct ContentView: View {
    var body: some View {
        // BAD: layout decided from the device screen bounds, once.
        let screen = UIScreen.main.bounds
        VStack {
            Text("Width is \(Int(screen.width))")
        }
        .frame(width: 375, height: 600)
    }
}
