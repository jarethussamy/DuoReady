import SwiftUI

struct ContentView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        // GOOD: let the available space decide. NavigationSplitView shows
        // list and detail side by side when wide (unfolded) and collapses
        // to a single column when compact (folded / Split View).
        NavigationSplitView {
            List(["Inbox", "Drafts", "Sent"], id: \.self) { name in
                Text(name)
            }
        } detail: {
            Text(sizeClass == .regular ? "Pick a message" : "Inbox")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
